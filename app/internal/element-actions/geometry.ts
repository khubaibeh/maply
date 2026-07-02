import type { Element, PathElement, TextElement } from "../../domain/elements";
import type { Point } from "../../domain/geometry";
import { getWrappedTextLayout } from "./text";

type Bounds = {
	x: number;
	y: number;
	width: number;
	height: number;
};

const CURVE_SAMPLE_STEPS = 32;

export function getPathRenderTransform(element: PathElement): Point {
	// Path x/y stores the padded visual box, while SVG path data keeps its own local origin.
	const bounds = getPathDataBounds(element.d);
	const strokePadding = Math.ceil(element.strokeWidth / 2);

	return {
		x: Math.round(element.x - bounds.x + strokePadding),
		y: Math.round(element.y - bounds.y + strokePadding)
	};
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
