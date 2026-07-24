import type {
	CircleElement,
	Element,
	ImageElement,
	PathElement,
	Point,
	RectElement,
	TextElement
} from "@maply/model/types";
import { get } from "svelte/store";

import { fillState } from "../state/document";
import { getPointBounds, getShapeDragBox } from "./geometry";
import { createElementId, nextElementName } from "./naming";
import { toPath } from "./path";

/** Creates a rectangle from a pointer drag. */
export function rectFromDrag(
	start: Point,
	end: Point,
	elements: readonly Element[],
	square = false
): RectElement | null {
	const box = getShapeDragBox(start, end, square);

	if (!box) return null;

	return {
		id: createElementId(),
		name: nextElementName("rect", elements),
		type: "rect",
		locked: false,
		visible: true,
		bindable: true,
		x: Math.round(box.x),
		y: Math.round(box.y),
		width: Math.round(box.width),
		height: Math.round(box.height),
		fill: get(fillState),
		stroke: "#000000",
		strokeWidth: 0
	};
}

/** Creates a circle from a pointer drag. */
export function circleFromDrag(start: Point, end: Point, elements: readonly Element[]): CircleElement | null {
	const box = getShapeDragBox(start, end);

	if (!box) return null;

	const radius = Math.min(box.width, box.height) / 2;

	return {
		id: createElementId(),
		name: nextElementName("circle", elements),
		type: "circle",
		locked: false,
		visible: true,
		bindable: true,
		cx: Math.round(box.x + radius),
		cy: Math.round(box.y + radius),
		r: Math.round(radius),
		fill: get(fillState),
		stroke: "#000000",
		strokeWidth: 0
	};
}

/** Creates a text frame from a pointer drag. */
export function textFromDrag(start: Point, end: Point, elements: readonly Element[]): TextElement | null {
	const box = getShapeDragBox(start, end);

	if (!box) return null;

	return {
		id: createElementId(),
		name: nextElementName("text", elements),
		type: "text",
		locked: false,
		visible: true,
		bindable: false,
		x: Math.round(box.x),
		y: Math.round(box.y),
		width: Math.round(box.width),
		height: Math.round(box.height),
		text: "",
		fontSize: 24,
		fill: "#000000"
	};
}

/** Creates an empty image frame from a pointer drag. */
export function imageFromDrag(start: Point, end: Point, elements: readonly Element[]): ImageElement | null {
	const box = getShapeDragBox(start, end);

	if (!box) return null;

	return {
		id: createElementId(),
		name: nextElementName("image", elements),
		type: "image",
		locked: false,
		visible: true,
		bindable: false,
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

/** Creates an open or closed path from its committed vertices. */
export function pathFromPoints(
	points: readonly Point[],
	closed: boolean,
	elements: readonly Element[]
): PathElement | null {
	if (points.length < 2 || (closed && points.length < 3)) return null;

	const bounds = getPointBounds(points);

	return {
		id: createElementId(),
		name: nextElementName("path", elements),
		type: "path",
		locked: false,
		visible: true,
		bindable: true,
		x: Math.round(bounds.x),
		y: Math.round(bounds.y),
		d: toPath(points, closed),
		fill: closed ? get(fillState) : "none",
		stroke: "#000000",
		strokeWidth: closed ? 0 : 2,
		closed
	};
}
