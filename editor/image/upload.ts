import { svg } from "@maply/io";
import {
	ImageDimensionError,
	ImageInvalidSvgError,
	ImageReadError,
	ImageUnsupportedFormatError,
	validateImageMimeType
} from "@maply/io/effect";
import type { PreparedImage } from "@maply/io/types";
import { copyProjectEditorData } from "@maply/model";
import type { StoredImageAsset } from "@maply/model/types";
import { Effect, Result } from "effect";
import { get } from "svelte/store";

import { imageFromSize } from "../elements/create";
import { createElementId } from "../elements/naming";
import { history } from "../history";
import { replaceProjectEffect, runStorageEffect, withEditorWriteGate } from "../session/coordinator";
import { ImageAssetMissing, ImageAttachmentFailed, ImageTargetInvalid } from "../session/errors";
import { imageAssetState } from "../state/assets";
import { projectState, setProjectState } from "../state/document";
import { applyInternalEditorMutation, withAsyncEditorMutationEffect } from "../state/editing";
import { canvasState } from "../state/workspace";
import type { ImageAssetState, ProjectState } from "../types";
import { fitImageRect, withImageRect } from "./crop";

export type ImageFromFileError =
	ImageUnsupportedFormatError | ImageReadError | ImageInvalidSvgError | ImageDimensionError | ImageAttachmentFailed;

export type ImageFromFileResult = { ok: true; value: PreparedImage } | { ok: false; error: ImageFromFileError };

/**
 * Reads, validates, and attaches an image file to an element.
 *
 * For SVGs, delegates sanitization to @maply/io (rejects scripts, event handlers,
 * external hrefs). For raster images, reads directly as a data URL.
 *
 * Possible error types in the result:
 * - `ImageUnsupportedFormatError` — MIME type not in the allowed set
 * - `ImageInvalidSvgError` — SVG failed security validation
 * - `ImageReadError` — FileReader could not read the file
 * - `ImageDimensionError` — browser could not decode the image dimensions
 * - `ImageAttachmentFailed` — asset persistence or state publication failed
 */
export async function imageFromFile(id: string, file: File): Promise<ImageFromFileResult> {
	const preparedResult = await Effect.runPromise(Effect.result(prepareImageFileEffect(file)));
	if (Result.isFailure(preparedResult)) return { ok: false, error: preparedResult.failure };
	const prepared = preparedResult.success;

	const project = get(projectState);

	const asset: StoredImageAsset = {
		id: "",
		projectId: project.id,
		...prepared
	};

	const result = await replaceImageAsset(id, asset);
	if (!result.ok) {
		return { ok: false, error: new ImageAttachmentFailed({ cause: result.error }) };
	}

	return { ok: true, value: prepared };
}

/** Reads an image file and atomically adds it as a centered, canvas-fitted element. */
export async function addImageFromFile(file: File): Promise<ImageFromFileResult> {
	const preparedResult = await Effect.runPromise(Effect.result(prepareImageFileEffect(file)));
	if (Result.isFailure(preparedResult)) return { ok: false, error: preparedResult.failure };
	const prepared = preparedResult.success;
	return runStorageEffect(
		Effect.match(withAsyncEditorMutationEffect(withEditorWriteGate(addPreparedImageEffect(prepared))), {
			onFailure: (error): ImageFromFileResult => ({
				ok: false,
				error: new ImageAttachmentFailed({ cause: error })
			}),
			onSuccess: (): ImageFromFileResult => ({ ok: true, value: prepared })
		})
	);
}

const addPreparedImageEffect = Effect.fn("editor.image.addPrepared")(function* (prepared: PreparedImage) {
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
	const persistedAssets = yield* persistImageMutationEffect(project, elements, nextAssets);

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
			imageAssetState.set(Object.fromEntries(persistedAssets.map((entry) => [entry.id, entry])));
		});
		history.commit(historyTransaction);
		committed = true;
	} finally {
		if (!committed) history.cancel(historyTransaction);
	}
});

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
	return runStorageEffect(
		Effect.match(withAsyncEditorMutationEffect(withEditorWriteGate(replaceImageAssetEffect(id, asset))), {
			onFailure: (error) => ({ ok: false as const, error }),
			onSuccess: () => ({ ok: true as const })
		})
	);
}

const replaceImageAssetEffect = Effect.fn("editor.image.replaceAsset")(function* (id: string, asset: StoredImageAsset) {
	const project = get(projectState);
	const current = project.elements.find((element) => element.id === id);

	if (!current || current.type !== "image") {
		return yield* new ImageTargetInvalid({ elementId: id });
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
	const persistedAssets = yield* persistImageMutationEffect(project, elements, nextAssets);

	const historyTransaction = history.begin();
	let committed = false;
	try {
		applyInternalEditorMutation(() => {
			setProjectState({ ...project, elements }, "preserve");
			imageAssetState.set(Object.fromEntries(persistedAssets.map((entry) => [entry.id, entry])));
		});
		history.commit(historyTransaction);
		committed = true;
	} finally {
		if (!committed) history.cancel(historyTransaction);
	}
});

const prepareImageFileEffect = Effect.fn("editor.image.prepareFile")(function* (file: File) {
	const mimeType = yield* validateImageMimeType(file.type);
	return yield* Effect.tryPromise({
		try: () => prepareImage(file, mimeType, mimeType === "image/svg+xml"),
		catch: imagePreparationError
	});
});

function imagePreparationError(cause: unknown): ImageReadError | ImageInvalidSvgError | ImageDimensionError {
	if (cause instanceof SvgValidationError) return new ImageInvalidSvgError({ message: cause.message });
	if (cause instanceof DimensionError) {
		return new ImageDimensionError({ message: cause.message, details: cause });
	}
	return new ImageReadError({ message: "Failed to read image file.", details: cause });
}

const persistImageMutationEffect = Effect.fn("editor.image.persistMutation")(function* (
	project: ProjectState,
	elements: ProjectState["elements"],
	assets: ImageAssetState
) {
	const referenced: StoredImageAsset[] = [];
	for (const element of elements) {
		if (element.type !== "image" || !element.assetId) continue;
		const entry = assets[element.assetId];
		if (!entry) return yield* Effect.fail(new ImageAssetMissing({ assetId: element.assetId }));
		if (!referenced.some((candidate) => candidate.id === entry.id)) referenced.push(entry);
	}

	const canvas = get(canvasState);
	yield* replaceProjectEffect(
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

	return referenced;
});

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
