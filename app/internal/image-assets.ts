import type { StoredImageAsset } from "../domain/image-assets";

const SVG_MIME_TYPE = "image/svg+xml";
const SVG_XMLNS = "http://www.w3.org/2000/svg";

type FrameRect = {
	x: number;
	y: number;
	width: number;
	height: number;
};

type ImageCropState = {
	cropX: number;
	cropY: number;
	cropScale: number;
};

type ImageRenderParams = FrameRect &
	ImageCropState & {
		assetWidth: number;
		assetHeight: number;
	};

type ResizeCropParams = {
	previousFrame: FrameRect;
	nextFrame: FrameRect;
	assetWidth: number;
	assetHeight: number;
	maxCropScale?: number;
};

type ImageCropMetricsParams = {
	width: number;
	height: number;
	assetWidth: number;
	assetHeight: number;
	cropScale: number;
};

type ImageCropMetrics = {
	scaledWidth: number;
	scaledHeight: number;
	overflowX: number;
	overflowY: number;
};

type ImportedImageSource = {
	name: string;
	mimeType: string;
	dataUrl: string;
	width: number;
	height: number;
};

function createAssetId(): string {
	if (typeof crypto !== "undefined" && crypto.randomUUID) {
		return crypto.randomUUID();
	}

	return Math.random().toString(36).slice(2);
}

function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max);
}

export function isSvgMimeType(mimeType: string): boolean {
	return mimeType.trim().toLowerCase() === SVG_MIME_TYPE;
}

export function normalizeSvgMarkup(markup: string): string {
	const cleaned = markup
		.replace(/^\uFEFF/, "")
		.replace(/<\?xml[\s\S]*?\?>/gi, "")
		.replace(/<!doctype[\s\S]*?>/gi, "")
		.trim();

	if (!/^<svg[\s>]/i.test(cleaned)) {
		throw new Error("SVG uploads must contain a root <svg> element.");
	}

	if (/<script[\s>]/i.test(cleaned)) {
		throw new Error("SVG uploads with <script> are not supported.");
	}

	if (/\son[a-z-]+\s*=/i.test(cleaned)) {
		throw new Error("SVG uploads with inline event handlers are not supported.");
	}

	if (/(?:href|xlink:href)\s*=\s*(['"])(?!#)[^'"]+\1/i.test(cleaned)) {
		throw new Error("SVG uploads must be self-contained.");
	}

	if (!/xmlns\s*=\s*(['"])http:\/\/www\.w3\.org\/2000\/svg\1/i.test(cleaned)) {
		return cleaned.replace(/^<svg/i, `<svg xmlns="${SVG_XMLNS}"`);
	}

	return cleaned;
}

export function svgMarkupToDataUrl(markup: string): string {
	return `data:${SVG_MIME_TYPE};charset=utf-8,${encodeURIComponent(markup)}`;
}

export function normalizeSvgToDataUrl(markup: string): string {
	return svgMarkupToDataUrl(normalizeSvgMarkup(markup));
}

export function createStoredImageAsset(projectId: string, source: ImportedImageSource): StoredImageAsset {
	return {
		id: createAssetId(),
		projectId,
		name: source.name,
		mimeType: source.mimeType,
		dataUrl: source.dataUrl,
		width: source.width,
		height: source.height
	};
}

export function cloneStoredImageAsset(asset: StoredImageAsset, projectId: string): StoredImageAsset {
	return {
		...asset,
		id: createAssetId(),
		projectId
	};
}

export function getImageCropMetrics(params: ImageCropMetricsParams): ImageCropMetrics {
	const frameWidth = Math.max(1, params.width);
	const frameHeight = Math.max(1, params.height);
	const assetWidth = Math.max(1, params.assetWidth);
	const assetHeight = Math.max(1, params.assetHeight);
	const baseScale = Math.max(frameWidth / assetWidth, frameHeight / assetHeight);
	const cropScale = Math.max(1, params.cropScale / 100);
	const scaledWidth = assetWidth * baseScale * cropScale;
	const scaledHeight = assetHeight * baseScale * cropScale;
	return {
		scaledWidth,
		scaledHeight,
		overflowX: Math.max(0, scaledWidth - frameWidth),
		overflowY: Math.max(0, scaledHeight - frameHeight)
	};
}

export function getImageRenderRect(params: ImageRenderParams): FrameRect {
	const frameWidth = Math.max(1, params.width);
	const frameHeight = Math.max(1, params.height);
	const { scaledWidth, scaledHeight, overflowX, overflowY } = getImageCropMetrics(params);
	const baseX = params.x + (frameWidth - scaledWidth) / 2;
	const baseY = params.y + (frameHeight - scaledHeight) / 2;
	const offsetX = baseX - (clamp(params.cropX, -100, 100) / 100) * (overflowX / 2);
	const offsetY = baseY - (clamp(params.cropY, -100, 100) / 100) * (overflowY / 2);

	return {
		x: Math.round(offsetX),
		y: Math.round(offsetY),
		width: Math.round(scaledWidth),
		height: Math.round(scaledHeight)
	};
}

export function translateImageCrop(
	current: ImageCropState,
	dx: number,
	dy: number,
	params: ImageCropMetricsParams
): Pick<ImageCropState, "cropX" | "cropY"> {
	const { overflowX, overflowY } = getImageCropMetrics(params);
	const nextCropX = overflowX === 0 ? current.cropX : current.cropX - (dx / (overflowX / 2)) * 100;
	const nextCropY = overflowY === 0 ? current.cropY : current.cropY - (dy / (overflowY / 2)) * 100;

	return {
		cropX: Math.round(clamp(nextCropX, -100, 100)),
		cropY: Math.round(clamp(nextCropY, -100, 100))
	};
}

export function getImageCropStateForFrameResize(current: ImageCropState, params: ResizeCropParams): ImageCropState {
	const previousRect = getImageRenderRect({
		...params.previousFrame,
		assetWidth: params.assetWidth,
		assetHeight: params.assetHeight,
		cropX: current.cropX,
		cropY: current.cropY,
		cropScale: current.cropScale
	});
	const maxCropScale = Math.max(100, params.maxCropScale ?? 800);
	const assetWidth = Math.max(1, params.assetWidth);
	const assetHeight = Math.max(1, params.assetHeight);
	const nextBaseScale = Math.max(params.nextFrame.width / assetWidth, params.nextFrame.height / assetHeight, 1e-6);
	const previousCombinedScale = previousRect.width / assetWidth;
	const nextCropScale = clamp(Math.round((previousCombinedScale / nextBaseScale) * 100), 100, maxCropScale);
	const { scaledWidth, scaledHeight, overflowX, overflowY } = getImageCropMetrics({
		width: params.nextFrame.width,
		height: params.nextFrame.height,
		assetWidth,
		assetHeight,
		cropScale: nextCropScale
	});
	const baseX = params.nextFrame.x + (params.nextFrame.width - scaledWidth) / 2;
	const baseY = params.nextFrame.y + (params.nextFrame.height - scaledHeight) / 2;
	const nextCropX = overflowX === 0 ? 0 : ((baseX - previousRect.x) / (overflowX / 2)) * 100;
	const nextCropY = overflowY === 0 ? 0 : ((baseY - previousRect.y) / (overflowY / 2)) * 100;

	return {
		cropX: Math.round(clamp(nextCropX, -100, 100)),
		cropY: Math.round(clamp(nextCropY, -100, 100)),
		cropScale: nextCropScale
	};
}

function readFileAsText(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onerror = () => reject(reader.error ?? new Error("Failed to read file."));
		reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
		reader.readAsText(file);
	});
}

function readFileAsDataUrl(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onerror = () => reject(reader.error ?? new Error("Failed to read file."));
		reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
		reader.readAsDataURL(file);
	});
}

function loadImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
	return new Promise((resolve, reject) => {
		const image = new Image();
		image.onload = () =>
			resolve({ width: image.naturalWidth || image.width, height: image.naturalHeight || image.height });
		image.onerror = () => reject(new Error("Failed to read image dimensions."));
		image.src = dataUrl;
	});
}

export async function importImageFile(file: File, projectId: string): Promise<StoredImageAsset> {
	const name = file.name || "image";
	const mimeType = file.type.toLowerCase();

	if (mimeType !== "image/png" && mimeType !== "image/jpeg" && !isSvgMimeType(mimeType)) {
		throw new Error("Only PNG, JPEG, and SVG files are supported.");
	}

	if (isSvgMimeType(mimeType)) {
		const markup = await readFileAsText(file);
		const dataUrl = normalizeSvgToDataUrl(markup);
		const dimensions = await loadImageDimensions(dataUrl);
		return createStoredImageAsset(projectId, {
			name,
			mimeType: SVG_MIME_TYPE,
			dataUrl,
			...dimensions
		});
	}

	const dataUrl = await readFileAsDataUrl(file);
	const dimensions = await loadImageDimensions(dataUrl);
	return createStoredImageAsset(projectId, {
		name,
		mimeType,
		dataUrl,
		...dimensions
	});
}
