import type { ImageElement, ImageRect } from "@maply/model/types";

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

/** Clamps a crop zoom percentage to the supported range. */
export function clampCropScale(scale: number): number {
	return Math.round(clamp(scale, 100, 800));
}

/** Fits an uncropped source image over a frame. */
export function fitImageRect(
	frame: { width: number; height: number },
	assetWidth: number,
	assetHeight: number
): ImageRect {
	const width = Math.max(1, frame.width);
	const height = Math.max(1, frame.height);
	const scale = Math.max(width / Math.max(1, assetWidth), height / Math.max(1, assetHeight));
	const imageWidth = Math.max(1, assetWidth) * scale;
	const imageHeight = Math.max(1, assetHeight) * scale;

	return {
		x: Math.round((width - imageWidth) / 2),
		y: Math.round((height - imageHeight) / 2),
		width: Math.round(imageWidth),
		height: Math.round(imageHeight)
	};
}

/** Moves an image within its frame without exposing empty space. */
export function translateImageRect(rect: ImageRect, frame: { width: number; height: number }, dx: number, dy: number) {
	return {
		...rect,
		x: Math.round(clamp(rect.x + dx, frame.width - rect.width, 0)),
		y: Math.round(clamp(rect.y + dy, frame.height - rect.height, 0))
	};
}

/** Scales an image around the frame center without exposing empty space. */
export function scaleImageRect(
	rect: ImageRect,
	frame: { width: number; height: number },
	previousScale: number,
	nextScale: number
) {
	const ratio = nextScale / Math.max(1, previousScale);
	const centerX = frame.width / 2;
	const centerY = frame.height / 2;
	const width = Math.max(frame.width, rect.width * ratio);
	const height = Math.max(frame.height, rect.height * ratio);

	return translateImageRect(
		{
			x: centerX + (rect.x - centerX) * ratio,
			y: centerY + (rect.y - centerY) * ratio,
			width,
			height
		},
		frame,
		0,
		0
	);
}

/** Scales a cropped image with an ordinary frame resize. */
export function resizeImageRect(rect: ImageRect, previous: ImageElement, next: ImageElement): ImageRect {
	const scaleX = next.width / Math.max(1, previous.width);
	const scaleY = next.height / Math.max(1, previous.height);

	return {
		x: Math.round(rect.x * scaleX),
		y: Math.round(rect.y * scaleY),
		width: Math.max(1, Math.round(rect.width * scaleX)),
		height: Math.max(1, Math.round(rect.height * scaleY))
	};
}

/** Stores a render rectangle on an image element. */
export function withImageRect(element: ImageElement, rect: ImageRect): ImageElement {
	return {
		...element,
		imageX: rect.x,
		imageY: rect.y,
		imageWidth: rect.width,
		imageHeight: rect.height
	};
}
