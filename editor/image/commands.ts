import { getImageRenderRect } from "@maply/model";
import type { ImageElement } from "@maply/model/types";
import { get } from "svelte/store";

import { resizeElement, type ResizeHandle, type ResizeOptions } from "../elements/resize";
import { imageAssetState } from "../state/assets";
import { projectState, setProjectState, updateProjectState } from "../state/document";
import { canvasState } from "../state/workspace";
import { clampCropScale, fitImageRect, scaleImageRect, translateImageRect, withImageRect } from "./crop";

/** Pans an image inside its crop frame. */
export function translateImageCrop(id: string, dx: number, dy: number): void {
	if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;

	const assets = get(imageAssetState);

	updateProjectState((state) => {
		const image = state.elements.find((element) => element.id === id);

		if (!image || image.type !== "image" || !image.assetId) return state;

		const asset = assets[image.assetId];

		if (!asset) return state;

		const rect = translateImageRect(getImageRenderRect(image, asset), image, dx, dy);

		return {
			...state,
			elements: state.elements.map((element) =>
				element.id === id && element.type === "image" ? withImageRect(element, rect) : element
			)
		};
	}, "preserve");
}

/** Sets a bounded image crop scale. */
export function setImageCropScale(id: string, scale: number): void {
	if (!Number.isFinite(scale)) return;

	const cropScale = clampCropScale(scale);
	const assets = get(imageAssetState);

	updateProjectState(
		(state) => ({
			...state,
			elements: state.elements.map((element) => {
				if (element.id !== id || element.type !== "image" || !element.assetId) return element;
				const asset = assets[element.assetId];
				if (!asset) return element;

				const current = getImageRenderRect(element, asset);
				const rect = scaleImageRect(current, element, element.cropScale, cropScale);
				return withImageRect({ ...element, cropScale }, rect);
			})
		}),
		"preserve"
	);
}

/** Restores the default crop offsets and scale for an image. */
export function resetImageCrop(id: string): void {
	const assets = get(imageAssetState);

	updateProjectState(
		(state) => ({
			...state,
			elements: state.elements.map((element) => {
				if (element.id !== id || element.type !== "image" || !element.assetId) return element;
				const asset = assets[element.assetId];
				if (!asset) return element;
				return withImageRect(
					{ ...element, cropX: 0, cropY: 0, cropScale: 100 },
					fitImageRect(element, asset.width, asset.height)
				);
			})
		}),
		"preserve"
	);
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
	const state = get(projectState);
	let beforeChange: ImageElement | null = null;
	let afterChange: ImageElement | null = null;

	const nextState = {
		...state,
		elements: state.elements.map((element) => {
			if (element.id !== id || element.type !== "image") return element;

			const original = source?.id === id ? source : element;
			const proposed = resizeElement(original, handle, dx, dy, canvas, options) as typeof element;
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
			beforeChange = element;
			afterChange = next;
			return next;
		})
	};
	const hint = beforeChange && afterChange ? { changed: { before: beforeChange, after: afterChange } } : "preserve";

	setProjectState(nextState, hint);
}
