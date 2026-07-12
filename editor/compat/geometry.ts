import type { Canvas, Element, ImageElement, PathElement, Point } from "@maply/model/types";

import { getPointBounds } from "../elements/geometry";
import { getSvgPathBounds } from "./path-geometry";
import { getWrappedTextMetrics } from "./text";

/** Legacy path point bounds used by current path handle UI. */
export function getPathDataBounds(points: Point[]) {
	return getPointBounds(points);
}

/** Legacy translation from stored visual box to rendered SVG path data origin. */
export function getPathRenderTransform(element: PathElement): Point {
	const bounds = getSvgPathBounds(element.d);
	const strokePadding = Math.ceil(element.strokeWidth / 2);
	return {
		x: Math.round(element.x - bounds.x + strokePadding),
		y: Math.round(element.y - bounds.y + strokePadding)
	};
}

/** Legacy rendered bounds used by migrated interaction callers. */
export function getElementBounds(element: Element) {
	if (element.type === "rect" || element.type === "image") {
		return { x: element.x, y: element.y, width: element.width, height: element.height };
	}
	if (element.type === "circle") {
		return { x: element.cx - element.r, y: element.cy - element.r, width: element.r * 2, height: element.r * 2 };
	}
	if (element.type === "text") {
		const metrics = getWrappedTextMetrics(element);
		return {
			x: Math.round(element.x - metrics.left),
			y: Math.round(element.y - metrics.ascent),
			width: Math.max(1, Math.round(element.width)),
			height: Math.max(1, Math.round(element.height))
		};
	}

	const bounds = getSvgPathBounds(element.d);
	const padding = Math.ceil(element.strokeWidth / 2);
	return { x: element.x, y: element.y, width: bounds.width + padding * 2, height: bounds.height + padding * 2 };
}

/** Legacy clamping using curve-aware path and browser-aligned text bounds. */
export function clampElementToCanvas(element: Element, canvas: Canvas): Element {
	let bounded = element;
	if (element.type === "circle") {
		bounded = {
			...element,
			r: Math.max(0, Math.min(Math.round(element.r), Math.floor(Math.min(canvas.width, canvas.height) / 2)))
		};
	} else if (element.type === "rect" || element.type === "image") {
		bounded = {
			...element,
			width: Math.min(Math.max(1, Math.round(element.width)), canvas.width),
			height: Math.min(Math.max(1, Math.round(element.height)), canvas.height)
		};
	} else if (element.type === "text") {
		bounded = {
			...element,
			width: Math.min(Math.max(1, Math.round(element.width)), canvas.width),
			height: Math.min(Math.max(1, Math.round(element.height)), canvas.height),
			fontSize: Math.min(Math.max(1, Math.round(element.fontSize)), canvas.height)
		};
	}

	const bounds = getElementBounds(bounded);
	const dx = clampDelta(bounds.x, bounds.width, canvas.x, canvas.width);
	const dy = clampDelta(bounds.y, bounds.height, canvas.y, canvas.height);
	if (dx === 0 && dy === 0) return bounded;
	return bounded.type === "circle"
		? { ...bounded, cx: Math.round(bounded.cx + dx), cy: Math.round(bounded.cy + dy) }
		: { ...bounded, x: Math.round(bounded.x + dx), y: Math.round(bounded.y + dy) };
}

/** Legacy image crop render rectangle used by current SVG/image UI. */
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

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

function clampDelta(position: number, size: number, canvasPosition: number, canvasSize: number): number {
	if (size > canvasSize || position < canvasPosition) return Math.round(canvasPosition - position);
	if (position + size > canvasPosition + canvasSize) {
		return Math.round(canvasPosition + canvasSize - position - size);
	}
	return 0;
}
