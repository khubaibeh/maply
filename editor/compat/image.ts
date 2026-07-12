import type { ImageElement } from "@maply/model/types";
import { get } from "svelte/store";

import { resizeElement, type ResizeHandle, type ResizeOptions } from "../elements/resize";
import { imageAssetState } from "../state/assets";
import { projectState } from "../state/document";
import { canvasState } from "../state/workspace";
import { getImageRenderRect } from "./geometry";

/** Compatibility resize flow that preserves the pointer-down crop and frame state. */
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

	projectState.update((state) => ({
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

			if (!original.assetId) return nextFrame;

			const asset = assets[original.assetId];
			if (!asset) return nextFrame;

			const crop = cropForFrameResize(original, nextFrame, asset.width, asset.height);

			return { ...nextFrame, ...crop };
		})
	}));
}

function cropForFrameResize(
	previous: ImageElement,
	next: ImageElement,
	assetWidthValue: number,
	assetHeightValue: number
) {
	const assetWidth = Math.max(1, assetWidthValue);
	const assetHeight = Math.max(1, assetHeightValue);
	const rendered = getImageRenderRect({ ...previous, assetWidth, assetHeight });
	const nextBaseScale = Math.max(next.width / assetWidth, next.height / assetHeight, 1e-6);
	const cropScale = clamp(Math.round((rendered.width / assetWidth / nextBaseScale) * 100), 100, 800);
	const scale = Math.max(next.width / assetWidth, next.height / assetHeight) * Math.max(1, cropScale / 100);
	const width = assetWidth * scale;
	const height = assetHeight * scale;
	const overflowX = Math.max(0, width - next.width);
	const overflowY = Math.max(0, height - next.height);
	const baseX = next.x + (next.width - width) / 2;
	const baseY = next.y + (next.height - height) / 2;

	return {
		cropX: Math.round(clamp(overflowX === 0 ? 0 : ((baseX - rendered.x) / (overflowX / 2)) * 100, -100, 100)),
		cropY: Math.round(clamp(overflowY === 0 ? 0 : ((baseY - rendered.y) / (overflowY / 2)) * 100, -100, 100)),
		cropScale
	};
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}
