import type { ImageElement } from "@maply/model/types";
import { get } from "svelte/store";

import { resizeElement, type ResizeHandle, type ResizeOptions } from "../elements/resize";
import { imageAssetState } from "../state/assets";
import { projectState, setProjectState, updateProjectState } from "../state/document";
import { canvasState } from "../state/workspace";
import { clampCropScale, cropForImageFrameResize, translateCrop } from "./crop";

/** Pans an image inside its crop frame. */
export function translateImageCrop(id: string, dx: number, dy: number): void {
	if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;

	const assets = get(imageAssetState);

	updateProjectState((state) => {
		const image = state.elements.find((element) => element.id === id);

		if (!image || image.type !== "image" || !image.assetId) return state;

		const asset = assets[image.assetId];

		if (!asset) return state;

		const crop = translateCrop(image, dx, dy, {
			width: image.width,
			height: image.height,
			assetWidth: asset.width,
			assetHeight: asset.height,
			cropScale: image.cropScale
		});

		return {
			...state,
			elements: state.elements.map((element) =>
				element.id === id && element.type === "image" ? { ...element, ...crop } : element
			)
		};
	}, "preserve");
}

/** Sets a bounded image crop scale. */
export function setImageCropScale(id: string, scale: number): void {
	if (!Number.isFinite(scale)) return;

	const cropScale = clampCropScale(scale);

	updateProjectState(
		(state) => ({
			...state,
			elements: state.elements.map((element) =>
				element.id === id && element.type === "image" ? { ...element, cropScale } : element
			)
		}),
		"preserve"
	);
}

/** Restores the default crop offsets and scale for an image. */
export function resetImageCrop(id: string): void {
	updateProjectState(
		(state) => ({
			...state,
			elements: state.elements.map((element) =>
				element.id === id && element.type === "image"
					? { ...element, cropX: 0, cropY: 0, cropScale: 100 }
					: element
			)
		}),
		"preserve"
	);
}

/** Resizes an image frame and recalculates crop to preserve visible content. */
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
			const resized = resizeElement(original, handle, dx, dy, canvas, options) as typeof element;
			const width = Math.max(5, resized.width);
			const height = Math.max(5, resized.height);

			const nextFrame = {
				...resized,
				x: handle.includes("w") && resized.width < 5 ? original.x + original.width - width : resized.x,
				y: handle.includes("n") && resized.height < 5 ? original.y + original.height - height : resized.y,
				width,
				height
			};
			beforeChange = element;

			if (!original.assetId) return nextFrame;

			const asset = assets[original.assetId];
			if (!asset) return nextFrame;

			const nextCrop = cropForImageFrameResize(original, nextFrame, asset.width, asset.height);
			const next = { ...nextFrame, ...nextCrop };
			beforeChange = element;
			afterChange = next;
			return next;
		})
	};
	const hint = beforeChange && afterChange ? { changed: { before: beforeChange, after: afterChange } } : "preserve";

	setProjectState(nextState, hint);
}
