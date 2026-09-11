import { getImageRenderRect, getPathRenderTransform } from "@maply/model";
import type { Camera, Element, ImageElement, StoredImageAsset, TextElement } from "@maply/model/types";

const CANVAS_RENDERER_VISIBLE_LIMIT = 2_000;
const MAX_CACHED_PATHS = 2_048;
const MAX_CACHED_IMAGES = 128;
const GRID_SIZE = 20;

/** The interactive renderer selected for the current viewport. */
export type CanvasRendererKind = "svg" | "canvas";

/** Returns whether the Canvas2D scene should replace ordinary SVG element nodes. */
export function chooseCanvasRenderer(documentSize: number, visibleElementCount: number): CanvasRendererKind {
	return documentSize > 0 && visibleElementCount > CANVAS_RENDERER_VISIBLE_LIMIT ? "canvas" : "svg";
}

/** The canvas frame painted before the ordinary scene. */
export type CanvasSceneSurface = {
	x: number;
	y: number;
	width: number;
	height: number;
	color: string;
};

/** Public text-layout operations needed to match the SVG renderer. */
export type CanvasTextLayout = {
	readonly wrappedLines: (element: TextElement) => readonly string[];
	readonly wrappedLineHeight: (element: TextElement) => number;
	readonly wrappedMetrics: (element: TextElement) => { left: number; ascent: number };
};

/** Inputs required to paint one Canvas2D scene. */
export type CanvasSceneOptions = {
	width: number;
	height: number;
	pixelRatio: number;
	camera: Camera;
	surface: CanvasSceneSurface;
	elements: readonly Element[];
	assets: Readonly<Record<string, StoredImageAsset>>;
	text: CanvasTextLayout;
	onImageReady?: () => void;
};

/** Metrics returned by one scene paint. */
export type CanvasSceneMetrics = {
	candidateElements: number;
	renderedElements: number;
	imageElements: number;
	loadedImages: number;
	pathCacheSize: number;
	imageCacheSize: number;
};

/** A retained Canvas2D scene with bounded path and image caches. */
export type CanvasScene = {
	readonly render: (canvas: HTMLCanvasElement, options: CanvasSceneOptions) => CanvasSceneMetrics;
	readonly dispose: () => void;
};

type CachedImage = {
	readonly image: HTMLImageElement;
	loaded: boolean;
};

function cssColor(canvas: HTMLCanvasElement, property: string, fallback: string): string {
	if (typeof getComputedStyle !== "function") return fallback;
	return getComputedStyle(canvas).getPropertyValue(property).trim() || fallback;
}

function drawWorkspaceBackground(
	context: CanvasRenderingContext2D,
	canvas: HTMLCanvasElement,
	width: number,
	height: number,
	pixelRatio: number
): void {
	context.save();
	context.setTransform(1, 0, 0, 1, 0, 0);
	context.fillStyle = cssColor(canvas, "--muted", "#f5f5f5");
	context.fillRect(0, 0, width * pixelRatio, height * pixelRatio);
	context.fillStyle = cssColor(canvas, "--muted-foreground", "#737373");
	context.globalAlpha = 0.3;
	for (let x = 1; x < width; x += GRID_SIZE) {
		for (let y = 1; y < height; y += GRID_SIZE)
			context.fillRect(x * pixelRatio, y * pixelRatio, pixelRatio, pixelRatio);
	}
	context.restore();
}

function drawSurface(context: CanvasRenderingContext2D, surface: CanvasSceneSurface, camera: Camera): void {
	context.save();
	context.shadowColor = "rgba(0, 0, 0, 0.08)";
	context.shadowBlur = 3 / Math.max(camera.zoom, 0.1);
	context.shadowOffsetY = 1 / Math.max(camera.zoom, 0.1);
	context.fillStyle = surface.color;
	context.fillRect(surface.x, surface.y, surface.width, surface.height);
	context.shadowColor = "transparent";
	context.strokeStyle = "rgba(115, 115, 115, 0.35)";
	context.lineWidth = 1 / Math.max(camera.zoom, 0.1);
	context.strokeRect(surface.x, surface.y, surface.width, surface.height);
	context.restore();
}

function fillAndStroke(
	context: CanvasRenderingContext2D,
	fill: string,
	stroke: string,
	strokeWidth: number,
	paint: () => void
): void {
	if (fill !== "none") {
		context.fillStyle = fill;
		context.save();
		paint();
		context.fill();
		context.restore();
	}
	if (stroke !== "none" && strokeWidth > 0) {
		context.strokeStyle = stroke;
		context.lineWidth = strokeWidth;
		context.save();
		paint();
		context.stroke();
		context.restore();
	}
}

function drawRect(context: CanvasRenderingContext2D, element: Extract<Element, { type: "rect" }>): void {
	fillAndStroke(context, element.fill, element.stroke, element.strokeWidth, () => {
		context.beginPath();
		context.rect(element.x, element.y, element.width, element.height);
	});
}

function drawCircle(context: CanvasRenderingContext2D, element: Extract<Element, { type: "circle" }>): void {
	fillAndStroke(context, element.fill, element.stroke, element.strokeWidth, () => {
		context.beginPath();
		context.arc(element.cx, element.cy, element.r, 0, Math.PI * 2);
	});
}

function drawText(context: CanvasRenderingContext2D, element: TextElement, text: CanvasTextLayout): void {
	const lines = text.wrappedLines(element);
	const lineHeight = text.wrappedLineHeight(element);
	const metrics = text.wrappedMetrics(element);

	context.save();
	context.beginPath();
	context.rect(element.x - metrics.left, element.y - metrics.ascent, element.width, element.height);
	context.clip();
	context.font = `${element.fontSize}px "Inter Variable", sans-serif`;
	context.textBaseline = "alphabetic";
	context.fillStyle = element.fill;
	for (const [index, line] of lines.entries())
		context.fillText(line || " ", element.x, element.y + index * lineHeight);
	context.restore();
}

function drawPath(
	context: CanvasRenderingContext2D,
	element: Extract<Element, { type: "path" }>,
	path: Path2D | undefined
): void {
	if (!path) return;
	const transform = getPathRenderTransform(element);
	context.save();
	context.translate(transform.x, transform.y);
	if (element.fill !== "none") {
		context.fillStyle = element.fill;
		context.fill(path);
	}
	if (element.stroke !== "none" && element.strokeWidth > 0) {
		context.strokeStyle = element.stroke;
		context.lineWidth = element.strokeWidth;
		context.stroke(path);
	}
	context.restore();
}

function drawImagePlaceholder(
	context: CanvasRenderingContext2D,
	element: ImageElement,
	canvas: HTMLCanvasElement
): void {
	context.fillStyle = cssColor(canvas, "--muted", "#e5e5e5");
	context.fillRect(element.x, element.y, element.width, element.height);
}

function drawImage(
	context: CanvasRenderingContext2D,
	element: ImageElement,
	asset: StoredImageAsset | undefined,
	image: CachedImage | undefined,
	canvas: HTMLCanvasElement
): boolean {
	drawImagePlaceholder(context, element, canvas);
	if (!image?.loaded) return false;

	const renderRect = asset
		? getImageRenderRect(element, asset)
		: { x: 0, y: 0, width: element.width, height: element.height };
	context.save();
	context.beginPath();
	context.rect(element.x, element.y, element.width, element.height);
	context.clip();
	context.drawImage(
		image.image,
		element.x + renderRect.x,
		element.y + renderRect.y,
		renderRect.width,
		renderRect.height
	);
	context.restore();
	return true;
}

/** Creates a Canvas2D scene painter for dense interactive documents. */
export function createCanvasScene(): CanvasScene {
	const pathCache = new Map<string, Path2D>();
	const imageCache = new Map<string, CachedImage>();
	let disposed = false;

	function pathFor(data: string): Path2D | undefined {
		const cached = pathCache.get(data);
		if (cached) return cached;
		if (typeof Path2D === "undefined") return undefined;
		try {
			const path = new Path2D(data);
			pathCache.set(data, path);
			if (pathCache.size > MAX_CACHED_PATHS) {
				const oldest = pathCache.keys().next().value;
				if (oldest !== undefined) pathCache.delete(oldest);
			}
			return path;
		} catch {
			return undefined;
		}
	}

	function imageFor(href: string, onImageReady: (() => void) | undefined): CachedImage | undefined {
		if (!href || typeof Image === "undefined") return undefined;
		const cached = imageCache.get(href);
		if (cached) return cached;

		const entry: CachedImage = { image: new Image(), loaded: false };
		entry.image.onload = () => {
			entry.loaded = true;
			if (!disposed) onImageReady?.();
		};
		entry.image.src = href;
		imageCache.set(href, entry);
		if (imageCache.size > MAX_CACHED_IMAGES) {
			const oldest = imageCache.keys().next().value;
			if (oldest !== undefined) imageCache.delete(oldest);
		}
		return entry;
	}

	return {
		render: (canvas, options) => {
			const context = canvas.getContext("2d");
			if (!context)
				return {
					candidateElements: 0,
					renderedElements: 0,
					imageElements: 0,
					loadedImages: 0,
					pathCacheSize: pathCache.size,
					imageCacheSize: imageCache.size
				};

			const requestedPixelRatio =
				Number.isFinite(options.pixelRatio) && options.pixelRatio > 0 ? options.pixelRatio : 1;
			const pixelRatio = Math.min(2, Math.max(1, requestedPixelRatio));
			const pixelWidth = Math.max(1, Math.round(options.width * pixelRatio));
			const pixelHeight = Math.max(1, Math.round(options.height * pixelRatio));
			if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
			if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
			canvas.style.width = `${options.width}px`;
			canvas.style.height = `${options.height}px`;

			context.setTransform(1, 0, 0, 1, 0, 0);
			context.clearRect(0, 0, pixelWidth, pixelHeight);
			drawWorkspaceBackground(context, canvas, options.width, options.height, pixelRatio);
			context.setTransform(
				pixelRatio * options.camera.zoom,
				0,
				0,
				pixelRatio * options.camera.zoom,
				-pixelRatio * options.camera.x,
				-pixelRatio * options.camera.y
			);
			drawSurface(context, options.surface, options.camera);

			let renderedElements = 0;
			let imageElements = 0;
			let loadedImages = 0;
			for (const element of options.elements) {
				if (element.visible === false) continue;
				renderedElements += 1;
				switch (element.type) {
					case "rect":
						drawRect(context, element);
						break;
					case "circle":
						drawCircle(context, element);
						break;
					case "path":
						drawPath(context, element, pathFor(element.d));
						break;
					case "text":
						drawText(context, element, options.text);
						break;
					case "image": {
						imageElements += 1;
						const asset = element.assetId ? options.assets[element.assetId] : undefined;
						const href = asset?.dataUrl ?? element.href ?? "";
						const image = imageFor(href, options.onImageReady);
						if (drawImage(context, element, asset, image, canvas)) loadedImages += 1;
						break;
					}
				}
			}

			context.setTransform(1, 0, 0, 1, 0, 0);
			return {
				candidateElements: options.elements.length,
				renderedElements,
				imageElements,
				loadedImages,
				pathCacheSize: pathCache.size,
				imageCacheSize: imageCache.size
			};
		},
		dispose: () => {
			disposed = true;
			pathCache.clear();
			imageCache.clear();
		}
	};
}
