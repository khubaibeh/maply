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
