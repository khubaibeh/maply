import { getPathRenderTransform } from "@maply/model";
import type { Element, PathElement, Point } from "@maply/model/types";
import { Editor } from "editor";

const PATH_HIT_TOLERANCE_SCREEN_PX = 7;
const MAX_CACHED_PATHS = 2_048;
const CURVE_STEPS = 32;
const EPSILON = 1e-7;
const tokenPattern = /[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?/g;

type Segment = { readonly start: Point; readonly end: Point };

type PathSubpath = {
	readonly points: readonly Point[];
	readonly closed: boolean;
};

type ParsedPath = {
	readonly subpaths: readonly PathSubpath[];
};

type MutablePathSubpath = {
	points: Point[];
	closed: boolean;
};

/** Provides cached, shape-accurate hit tests for canvas interaction routing. */
export type ElementHitTester = {
	/** Returns whether a world-space point intersects the painted interaction geometry. */
	readonly isHit: (element: Element, point: Point, zoom: number) => boolean;
	/** Releases cached path geometry. */
	readonly dispose: () => void;
};

/** Returns the world-space radius of the path's existing 14px SVG interaction stroke. */
export function getPathHitTolerance(zoom: number): number {
	return PATH_HIT_TOLERANCE_SCREEN_PX / safeZoom(zoom);
}

/** Tests one element without retaining path geometry between calls. */
export function pointHitsElement(element: Element, point: Point, zoom: number): boolean {
	return hitTestElement(element, point, safeZoom(zoom), undefined);
}

/** Returns the highest ordered visible element whose rendered geometry contains a point. */
export function topmostHitElement(
	elements: readonly Element[],
	point: Point,
	zoom: number,
	hitTester: ElementHitTester
): Element | null {
	for (let index = elements.length - 1; index >= 0; index -= 1) {
		const element = elements[index];
		if (element && element.visible !== false && hitTester.isHit(element, point, zoom)) return element;
	}
	return null;
}

/** Creates a bounded hit tester for repeated pointer and hover queries. */
export function createElementHitTester(): ElementHitTester {
	const pathCache = new Map<string, ParsedPath | null>();

	function pathFor(data: string): ParsedPath | null {
		if (pathCache.has(data)) return pathCache.get(data) ?? null;
		const parsed = parsePath(data);
		pathCache.set(data, parsed);
		if (pathCache.size > MAX_CACHED_PATHS) {
			const oldest = pathCache.keys().next().value;
			if (oldest !== undefined) pathCache.delete(oldest);
		}
		return parsed;
	}

	return {
		isHit: (element, point, zoom) => hitTestElement(element, point, safeZoom(zoom), pathFor),
		dispose: () => pathCache.clear()
	};
}

function hitTestElement(
	element: Element,
	point: Point,
	zoom: number,
	pathFor: ((data: string) => ParsedPath | null) | undefined
): boolean {
	switch (element.type) {
		case "rect":
			return hitTestRect(element, point);
		case "circle":
			return hitTestCircle(element, point);
		case "path":
			return hitTestPath(element, point, zoom, pathFor ?? ((data) => parsePath(data)));
		case "text":
			return pointInBounds(point, Editor.geometry.elementBounds(element));
		case "image":
			return pointInBox(point, element.x, element.y, element.width, element.height);
	}
}

function hitTestRect(element: Extract<Element, { type: "rect" }>, point: Point): boolean {
	const inside = pointInBox(point, element.x, element.y, element.width, element.height);
	if (inside && element.fill !== "none") return true;
	if (element.stroke === "none" || element.strokeWidth <= 0) return false;

	const left = Math.min(element.x, element.x + element.width);
	const right = Math.max(element.x, element.x + element.width);
	const top = Math.min(element.y, element.y + element.height);
	const bottom = Math.max(element.y, element.y + element.height);
	const corners = [
		{ x: left, y: top },
		{ x: right, y: top },
		{ x: right, y: bottom },
		{ x: left, y: bottom }
	];
	return segmentsHitPoint(cycleSegments(corners, true), point, element.strokeWidth / 2);
}

function hitTestCircle(element: Extract<Element, { type: "circle" }>, point: Point): boolean {
	if (element.r < 0) return false;
	const distance = Math.hypot(point.x - element.cx, point.y - element.cy);
	if (element.fill !== "none" && distance <= element.r + EPSILON) return true;
	if (element.stroke === "none" || element.strokeWidth <= 0) return false;
	return Math.abs(distance - element.r) <= element.strokeWidth / 2 + EPSILON;
}

function hitTestPath(
	element: PathElement,
	point: Point,
	zoom: number,
	pathFor: (data: string) => ParsedPath | null
): boolean {
	const path = pathFor(element.d);
	if (!path) return false;

	const transform = getPathRenderTransform(element);
	const localPoint = { x: point.x - transform.x, y: point.y - transform.y };
	if (element.fill !== "none" && pointInFill(path, localPoint)) return true;

	return segmentsHitPoint(
		pathSegments(path),
		localPoint,
		Math.max(element.strokeWidth / 2, getPathHitTolerance(zoom))
	);
}

function pointInFill(path: ParsedPath, point: Point): boolean {
	let winding = 0;

	for (const subpath of path.subpaths) {
		if (subpath.points.length < 2) continue;
		const points = subpath.points;
		for (let index = 0; index < points.length; index += 1) {
			const start = points[index];
			const end = points[(index + 1) % points.length];
			if (!start || !end) continue;
			if (pointToSegmentDistance(point, start, end) <= EPSILON) return true;

			if (start.y <= point.y) {
				if (end.y > point.y && isLeft(start, end, point) > 0) winding += 1;
			} else if (end.y <= point.y && isLeft(start, end, point) < 0) {
				winding -= 1;
			}
		}
	}

	return winding !== 0;
}

function pathSegments(path: ParsedPath): Segment[] {
	const segments: Segment[] = [];
	for (const subpath of path.subpaths) {
		const points = subpath.points;
		for (let index = 1; index < points.length; index += 1) {
			const start = points[index - 1];
			const end = points[index];
			if (start && end) segments.push({ start, end });
		}
		if (subpath.closed && points.length > 1) {
			const start = points.at(-1);
			const end = points[0];
			if (start && end) segments.push({ start, end });
		}
		if (points.length === 1) {
			const point = points[0];
			if (point) segments.push({ start: point, end: point });
		}
	}
	return segments;
}

function segmentsHitPoint(segments: readonly Segment[], point: Point, tolerance: number): boolean {
	const safeTolerance = Math.max(0, tolerance);
	return segments.some(
		(segment) => pointToSegmentDistance(point, segment.start, segment.end) <= safeTolerance + EPSILON
	);
}

function cycleSegments(points: readonly Point[], closed: boolean): Segment[] {
	const path: ParsedPath = { subpaths: [{ points, closed }] };
	return pathSegments(path);
}

function pointToSegmentDistance(point: Point, start: Point, end: Point): number {
	const dx = end.x - start.x;
	const dy = end.y - start.y;
	const lengthSquared = dx * dx + dy * dy;
	if (lengthSquared <= EPSILON) return Math.hypot(point.x - start.x, point.y - start.y);

	const projection = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
	return Math.hypot(point.x - (start.x + projection * dx), point.y - (start.y + projection * dy));
}

function isLeft(start: Point, end: Point, point: Point): number {
	return (end.x - start.x) * (point.y - start.y) - (point.x - start.x) * (end.y - start.y);
}

function pointInBox(point: Point, x: number, y: number, width: number, height: number): boolean {
	return pointInBounds(point, {
		x: Math.min(x, x + width),
		y: Math.min(y, y + height),
		width: Math.abs(width),
		height: Math.abs(height)
	});
}

function pointInBounds(
	point: Point,
	bounds: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
): boolean {
	return (
		point.x >= bounds.x - EPSILON &&
		point.x <= bounds.x + bounds.width + EPSILON &&
		point.y >= bounds.y - EPSILON &&
		point.y <= bounds.y + bounds.height + EPSILON
	);
}

function safeZoom(zoom: number): number {
	return Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
}

function parsePath(data: string): ParsedPath | null {
	const tokens = data.match(tokenPattern) ?? [];
	if (tokens.length === 0) return null;

	const subpaths: MutablePathSubpath[] = [];
	let tokenIndex = 0;
	let command: string | null = null;
	let current: Point = { x: 0, y: 0 };
	let subpathStart: Point = current;
	let subpath: MutablePathSubpath | null = null;
	let previousCommand: string | null = null;
	let cubicControl: Point | null = null;
	let quadraticControl: Point | null = null;

	const read = (count: number): number[] | null => {
		if (tokenIndex + count > tokens.length) return null;
		const values = tokens.slice(tokenIndex, tokenIndex + count);
		if (values.some((token) => isCommandToken(token))) return null;
		const numbers = values.map(Number);
		if (numbers.some((value) => !Number.isFinite(value))) return null;
		tokenIndex += count;
		return numbers;
	};

	const ensureSubpath = (): MutablePathSubpath | null => subpath;
	const absolutePoint = (x: number, y: number, relative: boolean): Point =>
		relative ? { x: current.x + x, y: current.y + y } : { x, y };

	while (tokenIndex < tokens.length) {
		if (isCommandToken(tokens[tokenIndex])) command = tokens[tokenIndex++] ?? null;
		if (!command) return null;

		const upper = command.toUpperCase();
		if (upper === "Z") {
			if (!subpath) return null;
			subpath.closed = subpath.points.length > 1;
			current = subpathStart;
			previousCommand = upper;
			cubicControl = null;
			quadraticControl = null;
			command = null;
			continue;
		}

		const count = parameterCount(upper);
		if (count === null) return null;
		const values = read(count);
		if (!values) return null;
		const relative: boolean = command !== upper;

		if (upper === "M") {
			current = absolutePoint(values[0] ?? 0, values[1] ?? 0, relative);
			subpath = { points: [current], closed: false };
			subpaths.push(subpath);
			subpathStart = current;
			command = relative ? "l" : "L";
			previousCommand = upper;
			cubicControl = null;
			quadraticControl = null;
			continue;
		}

		const activeSubpath = ensureSubpath();
		if (!activeSubpath) return null;

		if (upper === "L") {
			current = absolutePoint(values[0] ?? 0, values[1] ?? 0, relative);
			activeSubpath.points.push(current);
			cubicControl = null;
			quadraticControl = null;
		} else if (upper === "H") {
			current = { x: relative ? current.x + (values[0] ?? 0) : (values[0] ?? 0), y: current.y };
			activeSubpath.points.push(current);
			cubicControl = null;
			quadraticControl = null;
		} else if (upper === "V") {
			current = { x: current.x, y: relative ? current.y + (values[0] ?? 0) : (values[0] ?? 0) };
			activeSubpath.points.push(current);
			cubicControl = null;
			quadraticControl = null;
		} else if (upper === "C") {
			const first = absolutePoint(values[0] ?? 0, values[1] ?? 0, relative);
			const second = absolutePoint(values[2] ?? 0, values[3] ?? 0, relative);
			const end = absolutePoint(values[4] ?? 0, values[5] ?? 0, relative);
			appendCubic(activeSubpath.points, current, first, second, end);
			current = end;
			cubicControl = second;
			quadraticControl = null;
		} else if (upper === "S") {
			const first =
				(previousCommand === "C" || previousCommand === "S") && cubicControl
					? reflect(cubicControl, current)
					: current;
			const second = absolutePoint(values[0] ?? 0, values[1] ?? 0, relative);
			const end = absolutePoint(values[2] ?? 0, values[3] ?? 0, relative);
			appendCubic(activeSubpath.points, current, first, second, end);
			current = end;
			cubicControl = second;
			quadraticControl = null;
		} else if (upper === "Q") {
			const control = absolutePoint(values[0] ?? 0, values[1] ?? 0, relative);
			const end = absolutePoint(values[2] ?? 0, values[3] ?? 0, relative);
			appendQuadratic(activeSubpath.points, current, control, end);
			current = end;
			quadraticControl = control;
			cubicControl = null;
		} else if (upper === "T") {
			const control: Point =
				(previousCommand === "Q" || previousCommand === "T") && quadraticControl
					? reflect(quadraticControl, current)
					: current;
			const end = absolutePoint(values[0] ?? 0, values[1] ?? 0, relative);
			appendQuadratic(activeSubpath.points, current, control, end);
			current = end;
			quadraticControl = control;
			cubicControl = null;
		} else if (upper === "A") {
			const end = absolutePoint(values[5] ?? 0, values[6] ?? 0, relative);
			appendArc(
				activeSubpath.points,
				current,
				end,
				values[0] ?? 0,
				values[1] ?? 0,
				values[2] ?? 0,
				(values[3] ?? 0) !== 0,
				(values[4] ?? 0) !== 0
			);
			current = end;
			cubicControl = null;
			quadraticControl = null;
		}

		previousCommand = upper;
	}

	return { subpaths };
}

function parameterCount(command: string): number | null {
	switch (command) {
		case "M":
		case "L":
		case "T":
			return 2;
		case "H":
		case "V":
			return 1;
		case "C":
			return 6;
		case "S":
		case "Q":
			return 4;
		case "A":
			return 7;
		default:
			return null;
	}
}

function isCommandToken(token: string | undefined): boolean {
	return token !== undefined && token.length === 1 && /[a-zA-Z]/.test(token);
}

function appendQuadratic(points: Point[], start: Point, control: Point, end: Point): void {
	for (let step = 1; step <= CURVE_STEPS; step += 1) {
		const t = step / CURVE_STEPS;
		const inverse = 1 - t;
		points.push({
			x: inverse * inverse * start.x + 2 * inverse * t * control.x + t * t * end.x,
			y: inverse * inverse * start.y + 2 * inverse * t * control.y + t * t * end.y
		});
	}
}

function appendCubic(points: Point[], start: Point, first: Point, second: Point, end: Point): void {
	for (let step = 1; step <= CURVE_STEPS; step += 1) {
		const t = step / CURVE_STEPS;
		const inverse = 1 - t;
		points.push({
			x:
				inverse ** 3 * start.x +
				3 * inverse ** 2 * t * first.x +
				3 * inverse * t ** 2 * second.x +
				t ** 3 * end.x,
			y:
				inverse ** 3 * start.y +
				3 * inverse ** 2 * t * first.y +
				3 * inverse * t ** 2 * second.y +
				t ** 3 * end.y
		});
	}
}

function appendArc(
	points: Point[],
	start: Point,
	end: Point,
	rx: number,
	ry: number,
	rotation: number,
	largeArc: boolean,
	sweep: boolean
): void {
	const radiusX = Math.abs(rx);
	const radiusY = Math.abs(ry);
	if (radiusX <= EPSILON || radiusY <= EPSILON) {
		points.push(end);
		return;
	}
	if (Math.abs(start.x - end.x) <= EPSILON && Math.abs(start.y - end.y) <= EPSILON) return;

	const phi = (rotation * Math.PI) / 180;
	const cosPhi = Math.cos(phi);
	const sinPhi = Math.sin(phi);
	const halfDeltaX = (start.x - end.x) / 2;
	const halfDeltaY = (start.y - end.y) / 2;
	const primeX = cosPhi * halfDeltaX + sinPhi * halfDeltaY;
	const primeY = -sinPhi * halfDeltaX + cosPhi * halfDeltaY;
	const radiiScale = (primeX * primeX) / (radiusX * radiusX) + (primeY * primeY) / (radiusY * radiusY);
	const scale = radiiScale > 1 ? Math.sqrt(radiiScale) : 1;
	const scaledRadiusX = radiusX * scale;
	const scaledRadiusY = radiusY * scale;
	const radiusTerm =
		(scaledRadiusX * scaledRadiusX * scaledRadiusY * scaledRadiusY -
			scaledRadiusX * scaledRadiusX * primeY * primeY -
			scaledRadiusY * scaledRadiusY * primeX * primeX) /
		(scaledRadiusX * scaledRadiusX * primeY * primeY + scaledRadiusY * scaledRadiusY * primeX * primeX);
	const coefficient = (largeArc === sweep ? -1 : 1) * Math.sqrt(Math.max(0, radiusTerm));
	const centerPrimeX = coefficient * ((scaledRadiusX * primeY) / scaledRadiusY);
	const centerPrimeY = coefficient * (-(scaledRadiusY * primeX) / scaledRadiusX);
	const center = {
		x: cosPhi * centerPrimeX - sinPhi * centerPrimeY + (start.x + end.x) / 2,
		y: sinPhi * centerPrimeX + cosPhi * centerPrimeY + (start.y + end.y) / 2
	};
	const startVector = {
		x: (primeX - centerPrimeX) / scaledRadiusX,
		y: (primeY - centerPrimeY) / scaledRadiusY
	};
	const endVector = {
		x: (-primeX - centerPrimeX) / scaledRadiusX,
		y: (-primeY - centerPrimeY) / scaledRadiusY
	};
	const startAngle = Math.atan2(startVector.y, startVector.x);
	let deltaAngle = vectorAngle(startVector, endVector);
	if (!sweep && deltaAngle > 0) deltaAngle -= Math.PI * 2;
	if (sweep && deltaAngle < 0) deltaAngle += Math.PI * 2;

	const steps = Math.max(1, Math.ceil(Math.abs(deltaAngle) / (Math.PI / 16)));
	for (let step = 1; step < steps; step += 1) {
		const angle = startAngle + (deltaAngle * step) / steps;
		const localX = scaledRadiusX * Math.cos(angle);
		const localY = scaledRadiusY * Math.sin(angle);
		points.push({
			x: center.x + cosPhi * localX - sinPhi * localY,
			y: center.y + sinPhi * localX + cosPhi * localY
		});
	}
	points.push(end);
}

function vectorAngle(left: Point, right: Point): number {
	return Math.atan2(left.x * right.y - left.y * right.x, left.x * right.x + left.y * right.y);
}

function reflect(point: Point, around: Point): Point {
	return { x: around.x * 2 - point.x, y: around.y * 2 - point.y };
}
