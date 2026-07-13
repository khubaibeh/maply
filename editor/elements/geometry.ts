import type { Canvas, Element, PathElement, Point } from "@maply/model/types";

import { getSvgPathBounds } from "./path";
import { getTextBounds } from "./text";

const minShapeSize = 5;

/** Returns a valid drag box, or null when the drag is below the minimum shape size. */
export function getShapeDragBox(start: Point, end: Point, square = false) {
	let width = Math.abs(end.x - start.x);
	let height = Math.abs(end.y - start.y);
	let x = Math.min(start.x, end.x);
	let y = Math.min(start.y, end.y);

	if (square) {
		const size = Math.max(width, height);
		width = size;
		height = size;
		x = end.x < start.x ? start.x - size : start.x;
		y = end.y < start.y ? start.y - size : start.y;
	}

	if (width < minShapeSize || height < minShapeSize) return null;

	return { x, y, width, height };
}

/** Calculates the axis-aligned bounds of path points. */
export function getPointBounds(points: readonly Point[]) {
	if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };

	const xs = points.map((point) => point.x);
	const ys = points.map((point) => point.y);
	const x = Math.min(...xs);
	const y = Math.min(...ys);

	return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/** Returns the rendered axis-aligned bounds used for pure editor clamping. */
export function getElementBounds(element: Element) {
	switch (element.type) {
		case "rect":
		case "image":
			return { x: element.x, y: element.y, width: element.width, height: element.height };
		case "circle":
			return {
				x: element.cx - element.r,
				y: element.cy - element.r,
				width: element.r * 2,
				height: element.r * 2
			};
		case "text":
			return getTextBounds(element);
		case "path": {
			const bounds = getSvgPathBounds(element.d);
			const padding = Math.ceil(element.strokeWidth / 2);

			return {
				x: element.x,
				y: element.y,
				width: bounds.width + padding * 2,
				height: bounds.height + padding * 2
			};
		}
	}
}

/** Returns the smallest canvas size that can contain the largest current element without shrinking it. */
export function getMinimumCanvasSize(elements: readonly Element[]) {
	if (elements.length === 0) return { width: 1, height: 1 };

	let width = 1;
	let height = 1;

	for (const element of elements) {
		const bounds = getElementBounds(element);
		width = Math.max(width, Math.ceil(bounds.width));
		height = Math.max(height, Math.ceil(bounds.height));
	}

	return { width, height };
}

/** Translates a path's stored visual box to its rendered SVG data origin. */
export function getPathRenderTransform(element: PathElement): Point {
	const bounds = getSvgPathBounds(element.d);
	const strokePadding = Math.ceil(element.strokeWidth / 2);

	return {
		x: Math.round(element.x - bounds.x + strokePadding),
		y: Math.round(element.y - bounds.y + strokePadding)
	};
}

function getClampDelta(position: number, size: number, canvasPosition: number, canvasSize: number) {
	if (size > canvasSize) return Math.round(canvasPosition - position);
	if (position < canvasPosition) return Math.round(canvasPosition - position);
	if (position + size > canvasPosition + canvasSize) return Math.round(canvasPosition + canvasSize - position - size);

	return 0;
}

/** Clamps an element's frame and position to a canvas without browser measurement. */
export function clampElementToCanvas(element: Element, canvas: Canvas): Element {
	let bounded = element;

	if (element.type === "circle") {
		bounded = {
			...element,
			r: Math.max(0, Math.min(Math.round(element.r), Math.floor(Math.min(canvas.width, canvas.height) / 2)))
		};
	}

	if (element.type === "rect" || element.type === "image") {
		bounded = {
			...element,
			width: Math.min(Math.max(1, Math.round(element.width)), canvas.width),
			height: Math.min(Math.max(1, Math.round(element.height)), canvas.height)
		};
	}

	if (element.type === "text") {
		bounded = {
			...element,
			width: Math.min(Math.max(1, Math.round(element.width)), canvas.width),
			height: Math.min(Math.max(1, Math.round(element.height)), canvas.height),
			fontSize: Math.min(Math.max(1, Math.round(element.fontSize)), canvas.height)
		};
	}

	const bounds = getElementBounds(bounded);
	const dx = getClampDelta(bounds.x, bounds.width, canvas.x, canvas.width);
	const dy = getClampDelta(bounds.y, bounds.height, canvas.y, canvas.height);

	if (dx === 0 && dy === 0) return bounded;

	if (bounded.type === "circle") {
		return { ...bounded, cx: Math.round(bounded.cx + dx), cy: Math.round(bounded.cy + dy) };
	} else {
		return { ...bounded, x: Math.round(bounded.x + dx), y: Math.round(bounded.y + dy) };
	}
}
