import type { Canvas, ImageElement, Point } from "./schema";

/** Frame-local rectangle used to render an image independently of its crop frame. */
export type ImageRect = { x: number; y: number; width: number; height: number };

type ImageSize = { readonly width: number; readonly height: number };

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

/** Returns whether an image has a complete, finite, positive render rectangle. */
export function hasValidImageRect(element: ImageElement): element is ImageElement & {
	imageX: number;
	imageY: number;
	imageWidth: number;
	imageHeight: number;
} {
	return (
		typeof element.imageX === "number" &&
		typeof element.imageY === "number" &&
		typeof element.imageWidth === "number" &&
		typeof element.imageHeight === "number" &&
		Number.isFinite(element.imageX) &&
		Number.isFinite(element.imageY) &&
		Number.isFinite(element.imageWidth) &&
		Number.isFinite(element.imageHeight) &&
		element.imageWidth > 0 &&
		element.imageHeight > 0
	);
}

export function isPointInsideCanvas(point: Point, canvas: Canvas): boolean {
	return (
		point.x >= canvas.x &&
		point.y >= canvas.y &&
		point.x <= canvas.x + canvas.width &&
		point.y <= canvas.y + canvas.height
	);
}

/** Derives frame-local image geometry from legacy crop offset and scale fields. */
export function getLegacyImageRenderRect(element: ImageElement, asset: ImageSize): ImageRect {
	const frameWidth = Math.max(1, element.width);
	const frameHeight = Math.max(1, element.height);
	const assetWidth = Math.max(1, asset.width);
	const assetHeight = Math.max(1, asset.height);
	const baseScale = Math.max(frameWidth / assetWidth, frameHeight / assetHeight);
	const cropScale = Math.max(1, element.cropScale / 100);
	const width = Math.round(assetWidth * baseScale * cropScale);
	const height = Math.round(assetHeight * baseScale * cropScale);
	const overflowX = Math.max(0, width - frameWidth);
	const overflowY = Math.max(0, height - frameHeight);

	return {
		x: Math.round((frameWidth - width) / 2 - (clamp(element.cropX, -100, 100) / 100) * (overflowX / 2)),
		y: Math.round((frameHeight - height) / 2 - (clamp(element.cropY, -100, 100) / 100) * (overflowY / 2)),
		width,
		height
	};
}

/** Returns explicit image geometry, falling back to legacy crop fields. */
export function getImageRenderRect(element: ImageElement, asset: ImageSize): ImageRect {
	return hasValidImageRect(element)
		? { x: element.imageX, y: element.imageY, width: element.imageWidth, height: element.imageHeight }
		: getLegacyImageRenderRect(element, asset);
}
