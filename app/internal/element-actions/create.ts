import type {
	CircleElement,
	Element,
	ImageElement,
	PathElement,
	RectElement,
	TextElement
} from "../../domain/elements";
import type { Point } from "../../domain/geometry";
import { getPathDataBounds as getPointsBounds, pathDataFromPoints } from "../path-geometry";
import { MIN_SHAPE_SIZE } from "./constants";
import { createElementId, nextElementName } from "./naming";

export function getShapeDragBox(start: Point, end: Point, options: { square?: boolean } = {}) {
	let x = Math.min(start.x, end.x);
	let y = Math.min(start.y, end.y);
	let width = Math.abs(end.x - start.x);
	let height = Math.abs(end.y - start.y);

	if (options.square) {
		const size = Math.max(width, height);
		x = end.x < start.x ? start.x - size : start.x;
		y = end.y < start.y ? start.y - size : start.y;
		width = size;
		height = size;
	}

	if (width < MIN_SHAPE_SIZE || height < MIN_SHAPE_SIZE) return null;

	return { x, y, width, height };
}

export function createRectElement(point: Point, elements: Element[]): RectElement {
	return {
		id: createElementId(),
		name: nextElementName("rect", elements),
		type: "rect",
		x: Math.round(point.x),
		y: Math.round(point.y),
		width: 120,
		height: 80,
		fill: "#e5e5e5",
		stroke: "#000000",
		strokeWidth: 0
	};
}

export function createRectElementFromDrag(
	start: Point,
	end: Point,
	elements: Element[],
	options: { square?: boolean } = {}
): RectElement | null {
	const box = getShapeDragBox(start, end, options);
	if (!box) return null;

	return {
		id: createElementId(),
		name: nextElementName("rect", elements),
		type: "rect",
		x: Math.round(box.x),
		y: Math.round(box.y),
		width: Math.round(box.width),
		height: Math.round(box.height),
		fill: "#e5e5e5",
		stroke: "#000000",
		strokeWidth: 0
	};
}

export function createCircleElementFromDrag(start: Point, end: Point, elements: Element[]): CircleElement | null {
	const box = getShapeDragBox(start, end);
	if (!box) return null;

	const diameter = Math.min(box.width, box.height);
	const radius = diameter / 2;

	return {
		id: createElementId(),
		name: nextElementName("circle", elements),
		type: "circle",
		cx: Math.round(box.x + radius),
		cy: Math.round(box.y + radius),
		r: Math.round(radius),
		fill: "#e5e5e5",
		stroke: "#000000",
		strokeWidth: 0
	};
}

export function createTextElementFromDrag(start: Point, end: Point, elements: Element[]): TextElement | null {
	const box = getShapeDragBox(start, end);
	if (!box) return null;

	return {
		id: createElementId(),
		name: nextElementName("text", elements),
		type: "text",
		x: Math.round(box.x),
		y: Math.round(box.y),
		width: Math.round(box.width),
		height: Math.round(box.height),
		text: "",
		fontSize: 24,
		fill: "#000000"
	};
}

export function createImageElementFromDrag(start: Point, end: Point, elements: Element[]): ImageElement | null {
	const box = getShapeDragBox(start, end);
	if (!box) return null;

	return {
		id: createElementId(),
		name: nextElementName("image", elements),
		type: "image",
		x: Math.round(box.x),
		y: Math.round(box.y),
		width: Math.round(box.width),
		height: Math.round(box.height),
		assetId: null,
		href: "",
		cropX: 0,
		cropY: 0,
		cropScale: 100
	};
}

export function createPathElementFromPoints(points: Point[], closed: boolean, elements: Element[]): PathElement | null {
	if (points.length < 2) return null;
	if (closed && points.length < 3) return null;

	const d = pathDataFromPoints(points, closed);
	const bounds = getPointsBounds(points);

	return {
		id: createElementId(),
		name: nextElementName("path", elements),
		type: "path",
		x: Math.round(bounds.x),
		y: Math.round(bounds.y),
		d,
		fill: closed ? "#9ca3af" : "none",
		stroke: "#000000",
		strokeWidth: closed ? 0 : 2,
		closed
	};
}
