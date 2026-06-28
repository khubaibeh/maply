import { createUniqueElementName } from "$lib/app/core/element-name-validation";

import type {
	CircleElement,
	Element,
	ElementType,
	ImageElement,
	PathElement,
	RectElement,
	TextElement
} from "../domain/elements";
import type { Point } from "../domain/geometry";
import type { Canvas } from "../domain/project";
import { getPathDataBounds as getPointsBounds, pathDataFromPoints } from "./path-geometry";

// Element mutations stay canvas-safe here so UI handlers can work with raw deltas.
const PASTE_OFFSET = 20;
export const MIN_SHAPE_SIZE = 5;
const CURVE_SAMPLE_STEPS = 32;
const TEXT_DESCENT_RATIO = 0.2;
const TEXT_LINE_HEIGHT_RATIO = 1.2;
const TEXT_FONT_FAMILY = '"Inter Variable", sans-serif';
const TEXT_WRAP_SAFETY_MARGIN = 2;

let textMeasureContext: CanvasRenderingContext2D | null | undefined;

type TextLayout = {
	lines: string[];
	lineHeight: number;
	left: number;
	right: number;
	ascent: number;
	descent: number;
};

const defaultNames: Record<ElementType, string> = {
	rect: "rectangle",
	circle: "circle",
	path: "path",
	text: "text",
	image: "image"
};

export function createElementId(): string {
	if (typeof crypto !== "undefined" && crypto.randomUUID) {
		return crypto.randomUUID();
	}

	return Math.random().toString(36).slice(2);
}

export function defaultElementName(type: ElementType): string {
	return defaultNames[type];
}

export function nextElementName(type: ElementType, elements: Element[]): string {
	const count = elements.filter((element) => element.type === type).length;
	return createUniqueElementName(`${defaultElementName(type)}${count + 1}`, elements);
}

export function normalizeElement(element: Element): Element {
	const normalized: Element = {
		...element,
		name: typeof element.name === "string" ? element.name : defaultElementName(element.type)
	};

	if (normalized.type === "path") {
		if (typeof normalized.x !== "number" || typeof normalized.y !== "number") {
			normalized.x = 0;
			normalized.y = 0;
		}
		if (typeof normalized.closed !== "boolean") {
			normalized.closed = /\s*[Zz]\s*$/.test(normalized.d);
		}
		if (normalized.closed) {
			normalized.strokeWidth = 0;
		} else {
			normalized.fill = "none";
		}
	}

	if (normalized.type === "text" && (typeof normalized.width !== "number" || normalized.width < 1)) {
		normalized.width = estimateSingleLineTextWidth(normalized.text, normalized.fontSize);
	}

	if (normalized.type === "text" && (typeof normalized.height !== "number" || normalized.height < 1)) {
		normalized.height = estimateTextBoxHeight(normalized.fontSize, normalized.text);
	}

	if (normalized.type === "image") {
		normalized.assetId = typeof normalized.assetId === "string" ? normalized.assetId : null;
		normalized.cropX = typeof normalized.cropX === "number" ? Math.min(100, Math.max(-100, normalized.cropX)) : 0;
		normalized.cropY = typeof normalized.cropY === "number" ? Math.min(100, Math.max(-100, normalized.cropY)) : 0;
		normalized.cropScale = typeof normalized.cropScale === "number" ? Math.max(100, normalized.cropScale) : 100;
	}

	return normalized;
}

export function normalizeElements(elements: Element[]): Element[] {
	return elements.map(normalizeElement);
}

export function translateElement(element: Element, dx: number, dy: number): Element {
	switch (element.type) {
		case "rect":
		case "text":
		case "image":
		case "path":
			return { ...element, x: Math.round(element.x + dx), y: Math.round(element.y + dy) };
		case "circle":
			return { ...element, cx: Math.round(element.cx + dx), cy: Math.round(element.cy + dy) };
	}
}

export function translateElementWithinCanvas(element: Element, dx: number, dy: number, canvas: Canvas): Element {
	return clampElementToCanvas(translateElement(element, dx, dy), canvas);
}

export function setElementPosition(element: Element, x: number, y: number, canvas: Canvas): Element {
	const dx = x - (element.type === "circle" ? element.cx : element.x);
	const dy = y - (element.type === "circle" ? element.cy : element.y);
	return translateElementWithinCanvas(element, dx, dy, canvas);
}

export function getPathRenderTransform(element: PathElement): Point {
	// Path x/y stores the padded visual box, while SVG path data keeps its own local origin.
	const bounds = getPathDataBounds(element.d);
	const strokePadding = Math.ceil(element.strokeWidth / 2);

	return {
		x: Math.round(element.x - bounds.x + strokePadding),
		y: Math.round(element.y - bounds.y + strokePadding)
	};
}

export function clampElementToCanvas(element: Element, canvas: Canvas): Element {
	// Size is clamped first so the final position clamp uses the rendered bounds.
	const resized = clampElementSize(element, canvas);
	const bounds = getElementBounds(resized);
	const dx = getClampDelta(bounds.x, bounds.width, canvas.x, canvas.width);
	const dy = getClampDelta(bounds.y, bounds.height, canvas.y, canvas.height);

	return dx === 0 && dy === 0 ? resized : translateElement(resized, dx, dy);
}

export function duplicateElement(element: Element, elements: Element[] = [], offset = PASTE_OFFSET): Element {
	const next = translateElement(structuredClone(element), offset, offset);
	return {
		...next,
		id: createElementId(),
		name: createUniqueElementName(`${next.name}-copy`, elements)
	} as Element;
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

type Bounds = {
	x: number;
	y: number;
	width: number;
	height: number;
};

export type ResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export function resizeImageFrameWithinCanvas(
	element: ImageElement,
	handle: ResizeHandle,
	dx: number,
	dy: number,
	canvas: Canvas
): ImageElement {
	let left = element.x;
	let top = element.y;
	let right = element.x + element.width;
	let bottom = element.y + element.height;
	const canvasLeft = canvas.x;
	const canvasTop = canvas.y;
	const canvasRight = canvas.x + canvas.width;
	const canvasBottom = canvas.y + canvas.height;

	if (handle.includes("w")) {
		left = Math.min(right - MIN_SHAPE_SIZE, Math.max(canvasLeft, left + dx));
	}

	if (handle.includes("e")) {
		right = Math.max(left + MIN_SHAPE_SIZE, Math.min(canvasRight, right + dx));
	}

	if (handle.includes("n")) {
		top = Math.min(bottom - MIN_SHAPE_SIZE, Math.max(canvasTop, top + dy));
	}

	if (handle.includes("s")) {
		bottom = Math.max(top + MIN_SHAPE_SIZE, Math.min(canvasBottom, bottom + dy));
	}

	return {
		...element,
		x: Math.round(left),
		y: Math.round(top),
		width: Math.round(right - left),
		height: Math.round(bottom - top)
	};
}

function clampElementSize(element: Element, canvas: Canvas): Element {
	switch (element.type) {
		case "rect":
		case "image":
			return {
				...element,
				width: Math.min(Math.max(1, Math.round(element.width)), canvas.width),
				height: Math.min(Math.max(1, Math.round(element.height)), canvas.height)
			};
		case "circle":
			return {
				...element,
				r: Math.min(Math.max(0, Math.round(element.r)), Math.floor(Math.min(canvas.width, canvas.height) / 2))
			};
		case "text":
			return {
				...element,
				width: Math.min(Math.max(1, Math.round(element.width)), canvas.width),
				height: Math.min(Math.max(1, Math.round(element.height)), canvas.height),
				fontSize: Math.min(Math.max(1, Math.round(element.fontSize)), canvas.height)
			};
		case "path":
			return element;
	}
}

export function getElementBounds(element: Element): Bounds {
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
		case "path": {
			// Paths are positioned by their visual box; data bounds only provide the drawn size.
			const pathBounds = getPathDataBounds(element.d);
			const strokePadding = Math.ceil(element.strokeWidth / 2);
			return {
				x: element.x,
				y: element.y,
				width: pathBounds.width + strokePadding * 2,
				height: pathBounds.height + strokePadding * 2
			};
		}
		case "text":
			return getTextBounds(element);
	}
}

function getTextBounds(element: TextElement): Bounds {
	const metrics = getWrappedTextLayout(element);
	return {
		x: Math.round(element.x - metrics.left),
		y: Math.round(element.y - metrics.ascent),
		width: Math.max(1, Math.round(element.width)),
		height: Math.max(1, Math.round(element.height))
	};
}

export function getWrappedTextLines(element: TextElement) {
	return getWrappedTextLayout(element).lines;
}

export function getWrappedTextLineHeight(element: TextElement) {
	return getWrappedTextLayout(element).lineHeight;
}

export function getWrappedTextMetrics(element: TextElement) {
	const { left, ascent } = getWrappedTextLayout(element);
	return { left, ascent };
}

export function getTextLayoutMetrics(text: string, fontSize: number, width: number) {
	const { left, ascent } = getWrappedTextLayoutForContent(text, fontSize, width);
	return { left, ascent };
}

function getWrappedTextLayout(element: TextElement): TextLayout {
	return getWrappedTextLayoutForContent(element.text, element.fontSize, element.width);
}

function getWrappedTextLayoutForContent(text: string, fontSize: number, width: number): TextLayout {
	const metrics = measureWrappedTextBlock(text, fontSize, width);
	if (metrics) return metrics;

	const lines = wrapTextLinesFallback(text, fontSize, width);
	const lineHeight = fontSize * TEXT_LINE_HEIGHT_RATIO;
	const measuredWidth = Math.max(1, ...lines.map((line) => estimateSingleLineTextWidth(line, fontSize)));
	return {
		lines,
		lineHeight,
		left: 0,
		right: measuredWidth,
		ascent: fontSize,
		descent: Math.ceil(fontSize * TEXT_DESCENT_RATIO) + Math.max(0, lines.length - 1) * lineHeight
	};
}

function measureWrappedTextBlock(text: string, fontSize: number, width: number) {
	const context = getTextMeasureContext();
	if (!context) return null;

	context.font = `${fontSize}px ${TEXT_FONT_FAMILY}`;
	const lines = wrapTextLines(text, width, context);
	let left = 0;
	let right = 0;
	let ascent = fontSize;
	let descent = Math.ceil(fontSize * TEXT_DESCENT_RATIO);

	for (const line of lines) {
		const metrics = context.measureText(line || " ");
		left = Math.max(left, metrics.actualBoundingBoxLeft ?? 0);
		right = Math.max(right, metrics.actualBoundingBoxRight ?? metrics.width);
		ascent = Math.max(ascent, metrics.actualBoundingBoxAscent ?? fontSize);
		descent = Math.max(descent, metrics.actualBoundingBoxDescent ?? Math.ceil(fontSize * TEXT_DESCENT_RATIO));
	}

	const lineHeight = fontSize * TEXT_LINE_HEIGHT_RATIO;
	const extraLineHeight = Math.max(0, lines.length - 1) * lineHeight;

	return {
		lines,
		lineHeight,
		left,
		right,
		ascent,
		descent: descent + extraLineHeight
	};
}

function wrapTextLinesFallback(text: string, fontSize: number, width: number) {
	return wrapTextLines(text, width, null, (value) => estimateSingleLineTextWidth(value, fontSize));
}

function wrapTextLines(
	text: string,
	width: number,
	context: CanvasRenderingContext2D | null,
	measure = (value: string) => {
		if (!context) return value.length;
		return getMeasuredTextWidth(context.measureText(value || " "));
	}
) {
	const maxWidth = Math.max(1, width);
	const safeWidth = Math.max(1, maxWidth - TEXT_WRAP_SAFETY_MARGIN);
	const paragraphs = text.split("\n");
	const lines: string[] = [];

	for (const paragraph of paragraphs) {
		if (!paragraph) {
			lines.push("");
			continue;
		}

		const words = paragraph.split(/\s+/).filter(Boolean);
		let currentLine = "";

		for (const word of words) {
			const candidate = currentLine ? `${currentLine} ${word}` : word;
			if (measure(candidate) <= safeWidth) {
				currentLine = candidate;
				continue;
			}

			if (currentLine) {
				lines.push(currentLine);
				currentLine = "";
			}

			const segments = splitWordToWidth(word, safeWidth, measure);
			if (segments.length === 0) continue;
			lines.push(...segments.slice(0, -1));
			currentLine = segments.at(-1) ?? "";
		}

		lines.push(currentLine);
	}

	return lines.length > 0 ? lines : [""];
}

function splitWordToWidth(word: string, width: number, measure: (value: string) => number) {
	if (!word) return [""];
	if (measure(word) <= width) return [word];

	const segments: string[] = [];
	let remaining = word;

	while (remaining) {
		let chunk = "";
		let index = 0;

		while (index < remaining.length) {
			const nextChunk = `${chunk}${remaining[index]}`;
			const hasMore = index < remaining.length - 1;
			const candidate = hasMore ? `${nextChunk}-` : nextChunk;

			if (chunk && measure(candidate) > width) break;

			chunk = nextChunk;
			index += 1;
		}

		if (!chunk) {
			segments.push(remaining.length > 1 ? `${remaining[0]}-` : remaining[0]);
			remaining = remaining.slice(1);
			continue;
		}

		if (index < remaining.length) {
			segments.push(`${chunk}-`);
			remaining = remaining.slice(chunk.length);
			continue;
		}

		segments.push(chunk);
		break;
	}

	return segments;
}

function estimateSingleLineTextWidth(text: string, fontSize: number) {
	return Math.max(1, Math.round(Math.max(text.length, 1) * fontSize * 0.6));
}

function getMeasuredTextWidth(metrics: TextMetrics) {
	const left = metrics.actualBoundingBoxLeft ?? 0;
	const right = metrics.actualBoundingBoxRight ?? metrics.width;
	return left + right;
}

function estimateTextBoxHeight(fontSize: number, text: string) {
	return Math.ceil(
		fontSize * (1 + TEXT_DESCENT_RATIO + Math.max(0, text.split("\n").length - 1) * TEXT_LINE_HEIGHT_RATIO)
	);
}

function getTextMeasureContext() {
	if (textMeasureContext !== undefined) return textMeasureContext;
	if (typeof document === "undefined") {
		textMeasureContext = null;
		return textMeasureContext;
	}

	const canvas = document.createElement("canvas");
	textMeasureContext = canvas.getContext("2d");
	return textMeasureContext;
}

function getPathDataBounds(path: string): Bounds {
	// This is a tolerant SVG path scanner used for editor bounds, not a full renderer.
	const tokens = path.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?/g) ?? [];
	const points: Point[] = [];
	let index = 0;
	let command = "";
	let current: Point = { x: 0, y: 0 };
	let subpathStart: Point = { x: 0, y: 0 };
	let lastQuadraticControl: Point | null = null;
	let lastCubicControl: Point | null = null;

	while (index < tokens.length) {
		if (isPathCommand(tokens[index])) {
			command = tokens[index++];
		} else if (!command) {
			index++;
			continue;
		}

		const upperCommand = command.toUpperCase();
		const relative = command !== upperCommand;

		switch (upperCommand) {
			case "M": {
				let firstPoint = true;
				while (hasPathNumber(tokens, index)) {
					const values = readPathNumbers(tokens, index, 2);
					if (!values) {
						index += 1;
						break;
					}

					index += values.length;
					current = toPathPoint(values[0], values[1], relative, current);
					points.push(current);

					if (firstPoint) {
						subpathStart = current;
						firstPoint = false;
					}
				}
				lastQuadraticControl = null;
				lastCubicControl = null;
				break;
			}
			case "L": {
				while (hasPathNumber(tokens, index)) {
					const values = readPathNumbers(tokens, index, 2);
					if (!values) {
						index += 1;
						break;
					}

					index += values.length;
					current = toPathPoint(values[0], values[1], relative, current);
					points.push(current);
				}
				lastQuadraticControl = null;
				lastCubicControl = null;
				break;
			}
			case "H": {
				while (hasPathNumber(tokens, index)) {
					const values = readPathNumbers(tokens, index, 1);
					if (!values) {
						index += 1;
						break;
					}

					index += values.length;
					current = { x: relative ? current.x + values[0] : values[0], y: current.y };
					points.push(current);
				}
				lastQuadraticControl = null;
				lastCubicControl = null;
				break;
			}
			case "V": {
				while (hasPathNumber(tokens, index)) {
					const values = readPathNumbers(tokens, index, 1);
					if (!values) {
						index += 1;
						break;
					}

					index += values.length;
					current = { x: current.x, y: relative ? current.y + values[0] : values[0] };
					points.push(current);
				}
				lastQuadraticControl = null;
				lastCubicControl = null;
				break;
			}
			case "Q": {
				while (hasPathNumber(tokens, index)) {
					const values = readPathNumbers(tokens, index, 4);
					if (!values) {
						index += 1;
						break;
					}

					index += values.length;
					const control = toPathPoint(values[0], values[1], relative, current);
					const end = toPathPoint(values[2], values[3], relative, current);
					addQuadraticPoints(points, current, control, end);
					current = end;
					lastQuadraticControl = control;
					lastCubicControl = null;
				}
				break;
			}
			case "T": {
				while (hasPathNumber(tokens, index)) {
					const values = readPathNumbers(tokens, index, 2);
					if (!values) {
						index += 1;
						break;
					}

					index += values.length;
					const control: Point = lastQuadraticControl ? reflectPoint(lastQuadraticControl, current) : current;
					const end: Point = toPathPoint(values[0], values[1], relative, current);
					addQuadraticPoints(points, current, control, end);
					current = end;
					lastQuadraticControl = control;
					lastCubicControl = null;
				}
				break;
			}
			case "C": {
				while (hasPathNumber(tokens, index)) {
					const values = readPathNumbers(tokens, index, 6);
					if (!values) {
						index += 1;
						break;
					}

					index += values.length;
					const controlA = toPathPoint(values[0], values[1], relative, current);
					const controlB = toPathPoint(values[2], values[3], relative, current);
					const end = toPathPoint(values[4], values[5], relative, current);
					addCubicPoints(points, current, controlA, controlB, end);
					current = end;
					lastQuadraticControl = null;
					lastCubicControl = controlB;
				}
				break;
			}
			case "S": {
				while (hasPathNumber(tokens, index)) {
					const values = readPathNumbers(tokens, index, 4);
					if (!values) {
						index += 1;
						break;
					}

					index += values.length;
					const controlA: Point = lastCubicControl ? reflectPoint(lastCubicControl, current) : current;
					const controlB: Point = toPathPoint(values[0], values[1], relative, current);
					const end: Point = toPathPoint(values[2], values[3], relative, current);
					addCubicPoints(points, current, controlA, controlB, end);
					current = end;
					lastQuadraticControl = null;
					lastCubicControl = controlB;
				}
				break;
			}
			case "A": {
				while (hasPathNumber(tokens, index)) {
					const values = readPathNumbers(tokens, index, 7);
					if (!values) {
						index += 1;
						break;
					}

					index += values.length;
					const radiusX = Math.abs(values[0]);
					const radiusY = Math.abs(values[1]);
					const end = toPathPoint(values[5], values[6], relative, current);
					// Arc extrema are approximated from the endpoint radius box for fast selection bounds.
					points.push(
						current,
						end,
						{ x: end.x - radiusX, y: end.y - radiusY },
						{ x: end.x + radiusX, y: end.y + radiusY }
					);
					current = end;
				}
				lastQuadraticControl = null;
				lastCubicControl = null;
				break;
			}
			case "Z":
				current = subpathStart;
				points.push(current);
				lastQuadraticControl = null;
				lastCubicControl = null;
				break;
			default:
				index++;
				lastQuadraticControl = null;
				lastCubicControl = null;
				break;
		}
	}

	if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };

	const minX = Math.min(...points.map((point) => point.x));
	const minY = Math.min(...points.map((point) => point.y));
	const maxX = Math.max(...points.map((point) => point.x));
	const maxY = Math.max(...points.map((point) => point.y));

	return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function isPathCommand(token: string | undefined): boolean {
	return !!token && /^[a-zA-Z]$/.test(token);
}

function hasPathNumber(tokens: string[], index: number): boolean {
	return index < tokens.length && !isPathCommand(tokens[index]);
}

function readPathNumbers(tokens: string[], startIndex: number, count: number): number[] | null {
	const values: number[] = [];

	for (let offset = 0; offset < count; offset += 1) {
		const token = tokens[startIndex + offset];
		if (!token || isPathCommand(token)) return null;

		const value = Number(token);
		if (!Number.isFinite(value)) return null;
		values.push(value);
	}

	return values;
}

function toPathPoint(x: number, y: number, relative: boolean, current: Point): Point {
	return relative ? { x: current.x + x, y: current.y + y } : { x, y };
}

function reflectPoint(point: Point, around: Point): Point {
	return { x: around.x * 2 - point.x, y: around.y * 2 - point.y };
}

function addQuadraticPoints(points: Point[], start: Point, control: Point, end: Point) {
	// Fixed sampling keeps bounds predictable without pulling in a path measurement dependency.
	for (let step = 0; step <= CURVE_SAMPLE_STEPS; step += 1) {
		const t = step / CURVE_SAMPLE_STEPS;
		const inverse = 1 - t;
		points.push({
			x: inverse * inverse * start.x + 2 * inverse * t * control.x + t * t * end.x,
			y: inverse * inverse * start.y + 2 * inverse * t * control.y + t * t * end.y
		});
	}
}

function addCubicPoints(points: Point[], start: Point, controlA: Point, controlB: Point, end: Point) {
	// Fixed sampling keeps bounds predictable without pulling in a path measurement dependency.
	for (let step = 0; step <= CURVE_SAMPLE_STEPS; step += 1) {
		const t = step / CURVE_SAMPLE_STEPS;
		const inverse = 1 - t;
		points.push({
			x:
				inverse * inverse * inverse * start.x +
				3 * inverse * inverse * t * controlA.x +
				3 * inverse * t * t * controlB.x +
				t * t * t * end.x,
			y:
				inverse * inverse * inverse * start.y +
				3 * inverse * inverse * t * controlA.y +
				3 * inverse * t * t * controlB.y +
				t * t * t * end.y
		});
	}
}

function getClampDelta(position: number, size: number, canvasPosition: number, canvasSize: number): number {
	if (size > canvasSize) return Math.round(canvasPosition - position);
	if (position < canvasPosition) return Math.round(canvasPosition - position);
	if (position + size > canvasPosition + canvasSize)
		return Math.round(canvasPosition + canvasSize - (position + size));
	return 0;
}
