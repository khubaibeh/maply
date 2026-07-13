import type { ImageElement } from "@maply/model/types";

type Crop = { cropX: number; cropY: number; cropScale: number };
type Metrics = { width: number; height: number; assetWidth: number; assetHeight: number; cropScale: number };

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

/** Calculates the rendered image overflow within a crop frame. */
export function getCropMetrics(metrics: Metrics) {
	const width = Math.max(1, metrics.width);
	const height = Math.max(1, metrics.height);
	const assetWidth = Math.max(1, metrics.assetWidth);
	const assetHeight = Math.max(1, metrics.assetHeight);
	const baseScale = Math.max(width / assetWidth, height / assetHeight);

	const scale = Math.max(1, metrics.cropScale / 100);
	const scaledWidth = assetWidth * baseScale * scale;
	const scaledHeight = assetHeight * baseScale * scale;

	return {
		overflowX: Math.max(0, scaledWidth - metrics.width),
		overflowY: Math.max(0, scaledHeight - metrics.height)
	};
}

/** Converts frame-space drag deltas into bounded image crop offsets. */
export function translateCrop(current: Crop, dx: number, dy: number, metrics: Metrics): Pick<Crop, "cropX" | "cropY"> {
	const { overflowX, overflowY } = getCropMetrics(metrics);
	const cropX = overflowX === 0 ? current.cropX : current.cropX - (dx / (overflowX / 2)) * 100;
	const cropY = overflowY === 0 ? current.cropY : current.cropY - (dy / (overflowY / 2)) * 100;

	return { cropX: Math.round(clamp(cropX, -100, 100)), cropY: Math.round(clamp(cropY, -100, 100)) };
}

/** Clamps a crop zoom percentage to the supported range. */
export function clampCropScale(scale: number): number {
	return Math.round(clamp(scale, 100, 800));
}

/** Recalculates crop scale and offsets to preserve the visible content center across a frame resize. */
export function cropForFrameResize(current: Crop, previous: Metrics, next: Metrics): Crop {
	const prevBase = Math.max(
		previous.width / Math.max(1, previous.assetWidth),
		previous.height / Math.max(1, previous.assetHeight)
	);
	const nextBase = Math.max(next.width / Math.max(1, next.assetWidth), next.height / Math.max(1, next.assetHeight));

	const cropScale = clampCropScale(
		nextBase > 1e-6 ? ((prevBase * Math.max(1, current.cropScale / 100)) / nextBase) * 100 : current.cropScale
	);

	const prevMetrics = getCropMetrics(previous);
	const nextMetrics = getCropMetrics({ ...next, cropScale });

	const prevRenderedW = Math.max(1, previous.width) + prevMetrics.overflowX;
	const prevRenderedH = Math.max(1, previous.height) + prevMetrics.overflowY;
	const nextRenderedW = Math.max(1, next.width) + nextMetrics.overflowX;
	const nextRenderedH = Math.max(1, next.height) + nextMetrics.overflowY;

	const cropX =
		nextMetrics.overflowX === 0 || prevRenderedW === 0
			? 0
			: (current.cropX * (prevMetrics.overflowX * nextRenderedW)) / (prevRenderedW * nextMetrics.overflowX);

	const cropY =
		nextMetrics.overflowY === 0 || prevRenderedH === 0
			? 0
			: (current.cropY * (prevMetrics.overflowY * nextRenderedH)) / (prevRenderedH * nextMetrics.overflowY);

	return {
		cropX: Math.round(clamp(cropX, -100, 100)),
		cropY: Math.round(clamp(cropY, -100, 100)),
		cropScale
	};
}

/** Returns the source image rectangle rendered inside an image crop frame. */
export function getImageRenderRect(element: ImageElement & { assetWidth: number; assetHeight: number }) {
	const frameWidth = Math.max(1, element.width);
	const frameHeight = Math.max(1, element.height);
	const assetWidth = Math.max(1, element.assetWidth);
	const assetHeight = Math.max(1, element.assetHeight);

	const baseScale = Math.max(frameWidth / assetWidth, frameHeight / assetHeight);
	const cropScale = Math.max(1, element.cropScale / 100);

	const width = assetWidth * baseScale * cropScale;
	const height = assetHeight * baseScale * cropScale;
	const overflowX = Math.max(0, width - frameWidth);
	const overflowY = Math.max(0, height - frameHeight);

	const x = element.x + (frameWidth - width) / 2 - (clamp(element.cropX, -100, 100) / 100) * (overflowX / 2);
	const y = element.y + (frameHeight - height) / 2 - (clamp(element.cropY, -100, 100) / 100) * (overflowY / 2);

	return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
}

/** Recalculates crop state to preserve rendered image content across a frame resize. */
export function cropForImageFrameResize(
	previous: ImageElement,
	next: ImageElement,
	assetWidthValue: number,
	assetHeightValue: number
): Crop {
	const assetWidth = Math.max(1, assetWidthValue);
	const assetHeight = Math.max(1, assetHeightValue);

	const rendered = getImageRenderRect({ ...previous, assetWidth, assetHeight });

	const nextBaseScale = Math.max(next.width / assetWidth, next.height / assetHeight, 1e-6);
	const cropScale = clampCropScale((rendered.width / assetWidth / nextBaseScale) * 100);
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
