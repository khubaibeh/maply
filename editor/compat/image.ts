import type { ImageElement } from "@maply/model/types";
import { get } from "svelte/store";

import { resizeElement, type ResizeHandle, type ResizeOptions } from "../elements/resize";
import { cropForFrameResize } from "../image/crop";
import { imageAssetState } from "../state/assets";
import { projectState } from "../state/document";
import { canvasState } from "../state/workspace";

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
			const nextFrame = resizeElement(original, handle, dx, dy, canvas, options) as typeof element;

			if (!original.assetId) return nextFrame;

			const asset = assets[original.assetId];
			if (!asset) return nextFrame;

			const crop = cropForFrameResize(
				{ cropX: original.cropX, cropY: original.cropY, cropScale: original.cropScale },
				{
					width: original.width,
					height: original.height,
					assetWidth: asset.width,
					assetHeight: asset.height,
					cropScale: original.cropScale
				},
				{
					width: nextFrame.width,
					height: nextFrame.height,
					assetWidth: asset.width,
					assetHeight: asset.height,
					cropScale: original.cropScale
				}
			);

			return { ...nextFrame, ...crop };
		})
	}));
}
