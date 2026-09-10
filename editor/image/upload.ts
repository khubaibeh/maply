import { svg, validateMimeType } from "@maply/io";
import type { PreparedImage } from "@maply/io/types";
import { copyProjectEditorData } from "@maply/model";
import type { StoredImageAsset } from "@maply/model/types";
import { storage } from "@maply/storage";
import { get } from "svelte/store";

import { imageFromSize } from "../elements/create";
import { createElementId } from "../elements/naming";
import { history } from "../history";
import { imageAssetState } from "../state/assets";
import { projectState, setProjectState } from "../state/document";
import { applyInternalEditorMutation, beginAsyncEditorMutation } from "../state/editing";
import { acquireMutex } from "../state/mutex";
import { canvasState } from "../state/workspace";
import type { ImageAssetState, ProjectState } from "../types";
import { fitImageRect, withImageRect } from "./crop";

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
	const preparedResult = await prepareImageFile(file);
	if (!preparedResult.ok) return preparedResult;
	const prepared = preparedResult.value;

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

/** Reads an image file and atomically adds it as a centered, canvas-fitted element. */
export async function addImageFromFile(file: File): Promise<ImageFromFileResult> {
	const preparedResult = await prepareImageFile(file);
	if (!preparedResult.ok) return preparedResult;
	const prepared = preparedResult.value;
	const releaseMutation = beginAsyncEditorMutation();
	if (!releaseMutation) {
		return { ok: false, error: { type: "AttachmentFailed", cause: new Error("Editor is busy.") } };
	}
	const release = await acquireMutex();

	try {
		const project = get(projectState);
		const canvas = get(canvasState);
		const frame = imageFromSize(prepared.width, prepared.height, canvas, project.elements);
		const asset: StoredImageAsset = {
			id: createElementId(),
			projectId: project.id,
			...prepared
		};
		const image = withImageRect({ ...frame, assetId: asset.id }, fitImageRect(frame, asset.width, asset.height));
		const elements = [...project.elements, image];
		const nextAssets = { ...get(imageAssetState), [asset.id]: asset };
		const persisted = await persistImageMutation(project, elements, nextAssets);

		if (!persisted.ok) {
			return { ok: false, error: { type: "AttachmentFailed", cause: persisted.error } };
		}

		const historyTransaction = history.begin();
		let committed = false;
		try {
			applyInternalEditorMutation(() => {
				setProjectState(
					{
						...project,
						elements,
						selectedElementId: image.id,
						selectedElementIds: [image.id],
						hoveredElementId: null,
						cropEditingElementId: null
					},
					{ added: [image] }
				);
				imageAssetState.set(Object.fromEntries(persisted.assets.map((entry) => [entry.id, entry])));
			});
			history.commit(historyTransaction);
			committed = true;
		} finally {
			if (!committed) history.cancel(historyTransaction);
		}

		return { ok: true, value: prepared };
	} finally {
		release();
		releaseMutation();
	}
}

/**
 * Atomically replaces the image asset for an element and persists the full project state.
 *
 * Acquires the editor mutex to prevent concurrent asset swaps from interleaving.
 * Persists the replacement project and asset set before publishing either live store,
 * so a persistence failure leaves the editor session unchanged.
 *
 * After persistence, prunes any orphaned assets no longer referenced by any element.
 */
export async function replaceImageAsset(
	id: string,
	asset: StoredImageAsset
): Promise<{ ok: true } | { ok: false; error: unknown }> {
	const releaseMutation = beginAsyncEditorMutation();
	if (!releaseMutation) return { ok: false, error: new Error("Editor is busy.") };
	const release = await acquireMutex();

	try {
		const project = get(projectState);
		const current = project.elements.find((element) => element.id === id);

		if (!current || current.type !== "image") {
			return { ok: false, error: new Error("Target element is not an image.") };
		}

		const nextAsset = { ...asset, id: createElementId(), projectId: project.id };
		const elements = project.elements.map((element) => {
			if (element.id !== id || element.type !== "image") return element;
			const frame = { ...element };
			delete frame.href;

			return withImageRect(
				{
					...frame,
					assetId: nextAsset.id,
					cropX: 0,
					cropY: 0,
					cropScale: 100
				},
				fitImageRect(element, nextAsset.width, nextAsset.height)
			);
		});
		const nextAssets = { ...get(imageAssetState), [nextAsset.id]: nextAsset };
		const persisted = await persistImageMutation(project, elements, nextAssets);
		if (!persisted.ok) return persisted;

		const historyTransaction = history.begin();
		let committed = false;
		try {
			applyInternalEditorMutation(() => {
				setProjectState({ ...project, elements }, "preserve");
				imageAssetState.set(Object.fromEntries(persisted.assets.map((entry) => [entry.id, entry])));
			});
			history.commit(historyTransaction);
			committed = true;
		} finally {
			if (!committed) history.cancel(historyTransaction);
		}

		return { ok: true };
	} finally {
		release();
		releaseMutation();
	}
}

async function prepareImageFile(file: File): Promise<ImageFromFileResult> {
	const mimeResult = validateMimeType(file.type);
	if (!mimeResult.ok) return { ok: false, error: { type: "UnsupportedFormat", mimeType: file.type } };

	try {
		return { ok: true, value: await prepareImage(file, mimeResult.value.mimeType, mimeResult.value.isSvg) };
	} catch (cause) {
		if (cause instanceof SvgValidationError) {
			return { ok: false, error: { type: "InvalidSvg", message: cause.message } };
		}
		if (cause instanceof DimensionError) {
			return { ok: false, error: { type: "DimensionFailed", cause } };
		}
		return { ok: false, error: { type: "ReadFailed", cause } };
	}
}

async function persistImageMutation(
	project: ProjectState,
	elements: ProjectState["elements"],
	assets: ImageAssetState
): Promise<{ ok: true; assets: StoredImageAsset[] } | { ok: false; error: unknown }> {
	const referenced: StoredImageAsset[] = [];
	for (const element of elements) {
		if (element.type !== "image" || !element.assetId) continue;
		const entry = assets[element.assetId];
		if (!entry) return { ok: false, error: new Error(`Missing image asset: ${element.assetId}`) };
		if (!referenced.some((candidate) => candidate.id === entry.id)) referenced.push(entry);
	}

	const canvas = get(canvasState);
	const replaced = await storage.project.replace(
		{
			id: project.id,
			name: project.name,
			canvas: { width: canvas.width, height: canvas.height, color: canvas.color, x: canvas.x, y: canvas.y },
			camera: { ...canvas.camera },
			elements,
			editorData: copyProjectEditorData({ elementNameGrid: project.elementNameGrid }),
			isElementNameImportOpen: project.isElementNameImportOpen
		},
		referenced
	);

	return replaced.ok ? { ok: true, assets: referenced } : replaced;
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

		img.onload = () => {
			const width = img.naturalWidth || img.width;
			const height = img.naturalHeight || img.height;
			if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
				reject(new DimensionError("Image dimensions must be positive finite numbers."));
				return;
			}
			resolve({ width, height });
		};
		img.onerror = () => reject(new DimensionError("Failed to read image dimensions."));

		img.src = dataUrl;
	});
}
