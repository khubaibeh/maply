import { getImageRenderRect } from "@maply/model";
import type { ImageElement } from "@maply/model/types";
import { get } from "svelte/store";

import { resizeElement, type ResizeHandle, type ResizeOptions } from "../elements/resize";
import { imageAssetState } from "../state/assets";
import { documentIndex, updateIndexedProject } from "../state/document";
import { canvasState } from "../state/workspace";
import { clampCropScale, fitImageRect, scaleImageRect, translateImageRect, withImageRect } from "./crop";

/** Pans an image inside its crop frame. */
export function translateImageCrop(id: string, dx: number, dy: number): void {
	if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;

	const assets = get(imageAssetState);
	const image = documentIndex.get(id);
	if (!image || image.type !== "image" || !image.assetId) return;
	const asset = assets[image.assetId];
	if (!asset) return;
	const rect = translateImageRect(getImageRenderRect(image, asset), image, dx, dy);
	updateIndexedProject((document) =>
		document.update(id, (current) => (current.type === "image" ? withImageRect(current, rect) : current))
	);
}

/** Sets a bounded image crop scale. */
export function setImageCropScale(id: string, scale: number): void {
	if (!Number.isFinite(scale)) return;

	const cropScale = clampCropScale(scale);
	const assets = get(imageAssetState);
	const image = documentIndex.get(id);
	if (!image || image.type !== "image" || !image.assetId) return;
	const asset = assets[image.assetId];
	if (!asset) return;
	const current = getImageRenderRect(image, asset);
	const rect = scaleImageRect(current, image, image.cropScale, cropScale);
	updateIndexedProject((document) =>
		document.update(id, (element) =>
			element.type === "image" ? withImageRect({ ...element, cropScale }, rect) : element
		)
	);
}

/** Restores the default crop offsets and scale for an image. */
export function resetImageCrop(id: string): void {
	const assets = get(imageAssetState);
	const image = documentIndex.get(id);
	if (!image || image.type !== "image" || !image.assetId) return;
	const asset = assets[image.assetId];
	if (!asset) return;
	const next = withImageRect(
		{ ...image, cropX: 0, cropY: 0, cropScale: 100 },
		fitImageRect(image, asset.width, asset.height)
	);
	updateIndexedProject((document) => document.update(id, () => next));
}

/** Resizes an image frame while preserving the image's internal transform. */
export function resizeImageCropFrame(
	id: string,
	handle: ResizeHandle,
	dx: number,
	dy: number,
	options?: ResizeOptions,
	source?: ImageElement
): void {
	const canvas = get(canvasState);
	const assets = get(imageAssetState);
	const image = documentIndex.get(id);
	if (!image || image.type !== "image") return;
	const original = source?.id === id ? source : image;
	const proposed = resizeElement(original, handle, dx, dy, canvas, options) as ImageElement;
	const asset = original.assetId ? assets[original.assetId] : null;
	const rect = asset
		? getImageRenderRect(original, asset)
		: { x: 0, y: 0, width: original.width, height: original.height };
	const imageLeft = original.x + rect.x;
	const imageTop = original.y + rect.y;
	const imageRight = imageLeft + rect.width;
	const imageBottom = imageTop + rect.height;
	const fixedRight = original.x + original.width;
	const fixedBottom = original.y + original.height;
	const left = handle.includes("w") ? Math.max(imageLeft, Math.min(fixedRight - 5, proposed.x)) : original.x;
	const top = handle.includes("n") ? Math.max(imageTop, Math.min(fixedBottom - 5, proposed.y)) : original.y;
	const right = handle.includes("e")
		? Math.min(imageRight, Math.max(original.x + 5, proposed.x + proposed.width))
		: fixedRight;
	const bottom = handle.includes("s")
		? Math.min(imageBottom, Math.max(original.y + 5, proposed.y + proposed.height))
		: fixedBottom;

	const next = withImageRect(
		{
			...original,
			x: Math.round(left),
			y: Math.round(top),
			width: Math.round(right - left),
			height: Math.round(bottom - top),
			cropX: original.cropX,
			cropY: original.cropY,
			cropScale: original.cropScale
		},
		{ ...rect, x: imageLeft - left, y: imageTop - top }
	);
	updateIndexedProject((document) => document.update(id, () => next));
}
