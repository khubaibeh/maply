import { get } from "svelte/store";

import { imageAssetState } from "../state/assets";
import { projectState } from "../state/document";
import { clampCropScale, translateCrop } from "./crop";

/** Pans an image inside its crop frame. */
export function translateImageCrop(id: string, dx: number, dy: number): void {
	if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;

	const assets = get(imageAssetState);

	projectState.update((state) => {
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
	});
}

/** Sets a bounded image crop scale. */
export function setImageCropScale(id: string, scale: number): void {
	if (!Number.isFinite(scale)) return;

	const cropScale = clampCropScale(scale);

	projectState.update((state) => ({
		...state,
		elements: state.elements.map((element) =>
			element.id === id && element.type === "image" ? { ...element, cropScale } : element
		)
	}));
}

/** Restores the default crop offsets and scale for an image. */
export function resetImageCrop(id: string): void {
	projectState.update((state) => ({
		...state,
		elements: state.elements.map((element) =>
			element.id === id && element.type === "image" ? { ...element, cropX: 0, cropY: 0, cropScale: 100 } : element
		)
	}));
}
