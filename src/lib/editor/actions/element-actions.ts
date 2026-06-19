import type { Element, ElementType, PathElement, RectElement } from "$lib/editor/model/elements";
import type { Point } from "$lib/editor/model/geometry";
import type { Canvas } from "$lib/editor/model/project";

const PASTE_OFFSET = 20;
const CURVE_SAMPLE_STEPS = 32;

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
	return `${defaultElementName(type)}${count + 1}`;
}

export function normalizeElement(element: Element): Element {
	const normalized: Element = {
		...element,
		name: element.name?.trim() || defaultElementName(element.type)
	};

	if (normalized.type === "path" && (typeof normalized.x !== "number" || typeof normalized.y !== "number")) {
		normalized.x = 0;
		normalized.y = 0;
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

export function getPathRenderTransform(element: PathElement): Point {
	const bounds = getPathDataBounds(element.d);
	const strokePadding = Math.ceil(element.strokeWidth / 2);

	return {
		x: Math.round(element.x - bounds.x + strokePadding),
		y: Math.round(element.y - bounds.y + strokePadding)
	};
}

export function clampElementToCanvas(element: Element, canvas: Canvas): Element {
	const resized = clampElementSize(element, canvas);
	const bounds = getElementBounds(resized);
	const dx = getClampDelta(bounds.x, bounds.width, canvas.x, canvas.width);
	const dy = getClampDelta(bounds.y, bounds.height, canvas.y, canvas.height);

	return dx === 0 && dy === 0 ? resized : translateElement(resized, dx, dy);
}

export function duplicateElement(element: Element, offset = PASTE_OFFSET): Element {
	const next = translateElement(structuredClone(element), offset, offset);
	return {
		...next,
		id: createElementId(),
		name: `${next.name} copy`
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
		fill: "#000000",
		stroke: "#000000",
		strokeWidth: 0
	};
}

type Bounds = {
	x: number;
	y: number;
	width: number;
	height: number;
};

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
				fontSize: Math.min(Math.max(1, Math.round(element.fontSize)), canvas.height)
			};
		case "path":
			return element;
	}
}

function getElementBounds(element: Element): Bounds {
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
			return {
				x: element.x,
				y: element.y - element.fontSize,
				width: Math.max(1, Math.round(element.text.length * element.fontSize * 0.6)),
				height: element.fontSize
			};
	}
}

function getPathDataBounds(path: string): Bounds {
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
