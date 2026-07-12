import { svg, validateMimeType } from "@maply/io";
import type { PreparedImage } from "@maply/io/types";
import type { StoredImageAsset } from "@maply/model/types";
import { storage } from "@maply/storage";
import { get } from "svelte/store";

import { createElementId } from "../elements/naming";
import { imageAssetState } from "../state/assets";
import { projectState } from "../state/document";
import { acquireMutex } from "../state/mutex";
import { canvasState } from "../state/workspace";

export type ImageFromFileError =
	| { type: "UnsupportedFormat"; mimeType: string }
	| { type: "ReadFailed"; cause: unknown }
	| { type: "InvalidSvg"; message: string }
	| { type: "DimensionFailed"; cause: unknown }
	| { type: "AttachmentFailed"; cause: unknown };

export type ImageFromFileResult = { ok: true; value: PreparedImage } | { ok: false; error: ImageFromFileError };

/**
 * Reads, validates, and attaches an image file to an element.
 *
 * For SVGs, delegates sanitization to @maply/io (rejects scripts, event handlers,
 * external hrefs). For raster images, reads directly as a data URL.
 *
 * Possible error types in the result:
 * - `UnsupportedFormat` — MIME type not in the allowed set
 * - `InvalidSvg` — SVG failed security validation
 * - `ReadFailed` — FileReader could not read the file
 * - `DimensionFailed` — browser could not decode the image to extract dimensions
 * - `AttachmentFailed` — asset persistence or state update failed
 */
export async function imageFromFile(id: string, file: File): Promise<ImageFromFileResult> {
	const mimeResult = validateMimeType(file.type);

	if (!mimeResult.ok) {
		return { ok: false, error: { type: "UnsupportedFormat", mimeType: file.type } };
	}

	const { mimeType, isSvg } = mimeResult.value;

	let prepared: PreparedImage;

	try {
		prepared = await prepareImage(file, mimeType, isSvg);
	} catch (cause) {
		if (cause instanceof SvgValidationError) {
			return { ok: false, error: { type: "InvalidSvg", message: cause.message } };
		}

		if (cause instanceof DimensionError) {
			return { ok: false, error: { type: "DimensionFailed", cause } };
		}

		return { ok: false, error: { type: "ReadFailed", cause } };
	}

	const project = get(projectState);

	const asset: StoredImageAsset = {
		id: "",
		projectId: project.id,
		...prepared
	};

	const result = await replaceImageAsset(id, asset);
	if (!result.ok) {
		return { ok: false, error: { type: "AttachmentFailed", cause: result.error } };
	}

	return { ok: true, value: prepared };
}

/**
 * Atomically replaces the image asset for an element and persists the full project state.
 *
 * Acquires the editor mutex to prevent concurrent asset swaps from interleaving.
 * Updates state optimistically (stores first, then persists to IndexedDB) so that
 * concurrent readers always see a consistent snapshot.
 *
 * After persistence, prunes any orphaned assets no longer referenced by any element.
 */
export async function replaceImageAsset(
	id: string,
	asset: StoredImageAsset
): Promise<{ ok: true } | { ok: false; error: unknown }> {
	const release = await acquireMutex();

	try {
		const project = get(projectState);
		const current = project.elements.find((element) => element.id === id);

		if (!current || current.type !== "image") {
			return { ok: false, error: new Error("Target element is not an image.") };
		}

		const nextAsset = { ...asset, id: createElementId(), projectId: project.id };

		projectState.update((state) => ({
			...state,
			elements: state.elements.map((element) => {
				if (element.id !== id || element.type !== "image") return element;
				return { ...element, assetId: nextAsset.id, href: undefined, cropX: 0, cropY: 0, cropScale: 100 };
			})
		}));

		imageAssetState.update((assets) => ({ ...assets, [nextAsset.id]: nextAsset }));

		const live = get(projectState);
		const liveAssets = get(imageAssetState);

		const assetIdSet = new Set(
			live.elements.flatMap((element) => (element.type === "image" && element.assetId ? [element.assetId] : []))
		);

		const referencedAssets = [...assetIdSet]
			.map((assetId) => liveAssets[assetId])
			.filter((entry): entry is StoredImageAsset => entry !== undefined);

		const canvas = get(canvasState);
		const replaced = await storage.project.replace(
			{
				id: live.id,
				name: live.name,
				canvas: { width: canvas.width, height: canvas.height, color: canvas.color, x: canvas.x, y: canvas.y },
				camera: { ...canvas.camera },
				elements: live.elements,
				importExportState: { importsOpen: true, elementsOpen: true }
			},
			referencedAssets
		);

		if (!replaced.ok) {
			return { ok: false, error: replaced.error };
		}

		imageAssetState.update((assets) => {
			const currentAssetIds = new Set(
				get(projectState).elements.flatMap((el) => (el.type === "image" && el.assetId ? [el.assetId] : []))
			);

			const next = { ...assets };

			for (const key of Object.keys(next)) {
				if (!currentAssetIds.has(key) && next[key]?.projectId === project.id) {
					delete next[key];
				}
			}

			return next;
		});

		return { ok: true };
	} finally {
		release();
	}
}

class SvgValidationError extends Error {}
class DimensionError extends Error {}

/**
 * Converts a File into a PreparedImage (name, mimeType, dataUrl, width, height).
 *
 * @throws SvgValidationError — SVG markup failed sanitization
 * @throws DimensionError — browser could not decode the image
 * @throws Error — FileReader failed
 */
async function prepareImage(file: File, mimeType: string, isSvg: boolean): Promise<PreparedImage> {
	const name = file.name || "image";

	if (isSvg) {
		const markup = await readFileAsText(file);

		const result = svg.prepare(markup);

		if (!result.ok) {
			throw new SvgValidationError(result.error);
		}

		const { dataUrl } = result.value;
		const dimensions = await loadImageDimensions(dataUrl);

		return { name, mimeType: "image/svg+xml", dataUrl, ...dimensions };
	}

	const dataUrl = await readFileAsDataUrl(file);
	const dimensions = await loadImageDimensions(dataUrl);

	return { name, mimeType, dataUrl, ...dimensions };
}

function readFileAsText(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();

		reader.onerror = () => reject(reader.error ?? new Error("Failed to read file."));
		reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");

		reader.readAsText(file);
	});
}

function readFileAsDataUrl(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();

		reader.onerror = () => reject(reader.error ?? new Error("Failed to read file."));
		reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");

		reader.readAsDataURL(file);
	});
}

function loadImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
	return new Promise((resolve, reject) => {
		const img = new Image();

		img.onload = () => resolve({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
		img.onerror = () => reject(new DimensionError("Failed to read image dimensions."));

		img.src = dataUrl;
	});
}
