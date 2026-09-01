import type { Canvas, ImageElement, PathElement, Point } from "./schema";

const pathBoundsSteps = 32;
const pathTokenPattern = /[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?/g;

/** Frame-local rectangle used to render an image independently of its crop frame. */
export type ImageRect = { x: number; y: number; width: number; height: number };

type ImageSize = { readonly width: number; readonly height: number };

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

/** Returns whether an image has a complete, finite, positive render rectangle. */
export function hasValidImageRect(element: ImageElement): element is ImageElement & {
	imageX: number;
	imageY: number;
	imageWidth: number;
	imageHeight: number;
} {
	return (
		typeof element.imageX === "number" &&
		typeof element.imageY === "number" &&
		typeof element.imageWidth === "number" &&
		typeof element.imageHeight === "number" &&
		Number.isFinite(element.imageX) &&
		Number.isFinite(element.imageY) &&
		Number.isFinite(element.imageWidth) &&
		Number.isFinite(element.imageHeight) &&
		element.imageWidth > 0 &&
		element.imageHeight > 0
	);
}

export function isPointInsideCanvas(point: Point, canvas: Canvas): boolean {
	return (
		point.x >= canvas.x &&
		point.y >= canvas.y &&
		point.x <= canvas.x + canvas.width &&
		point.y <= canvas.y + canvas.height
	);
}

/** Derives frame-local image geometry from legacy crop offset and scale fields. */
export function getLegacyImageRenderRect(element: ImageElement, asset: ImageSize): ImageRect {
	const frameWidth = Math.max(1, element.width);
	const frameHeight = Math.max(1, element.height);
	const assetWidth = Math.max(1, asset.width);
	const assetHeight = Math.max(1, asset.height);
	const baseScale = Math.max(frameWidth / assetWidth, frameHeight / assetHeight);
	const cropScale = Math.max(1, element.cropScale / 100);
	const width = Math.round(assetWidth * baseScale * cropScale);
	const height = Math.round(assetHeight * baseScale * cropScale);
	const overflowX = Math.max(0, width - frameWidth);
	const overflowY = Math.max(0, height - frameHeight);

	return {
		x: Math.round((frameWidth - width) / 2 - (clamp(element.cropX, -100, 100) / 100) * (overflowX / 2)),
		y: Math.round((frameHeight - height) / 2 - (clamp(element.cropY, -100, 100) / 100) * (overflowY / 2)),
		width,
		height
	};
}

/** Returns explicit image geometry, falling back to legacy crop fields. */
export function getImageRenderRect(element: ImageElement, asset: ImageSize): ImageRect {
	return hasValidImageRect(element)
		? { x: element.imageX, y: element.imageY, width: element.imageWidth, height: element.imageHeight }
		: getLegacyImageRenderRect(element, asset);
}

/** Tolerantly approximates bounds for rendered SVG paths, including curves and arcs. */
export function getSvgPathBounds(path: string) {
	const tokens = path.match(pathTokenPattern) ?? [];
	const points: Point[] = [];
	let index = 0;
	let command = "";
	let current: Point = { x: 0, y: 0 };
	let start = current;
	let quadratic: Point | null = null;
	let cubic: Point | null = null;

	const read = (count: number) => {
		const values = tokens.slice(index, index + count);
		if (values.length !== count || values.some((token) => /^[a-zA-Z]$/.test(token))) return null;

		const numbers = values.map(Number);
		if (numbers.some((value) => !Number.isFinite(value))) return null;

		index += count;
		return numbers;
	};

	const point = (x: number, y: number, relative: boolean): Point =>
		relative ? { x: current.x + x, y: current.y + y } : { x, y };

	while (index < tokens.length) {
		if (/^[a-zA-Z]$/.test(tokens[index])) command = tokens[index++];
		if (!command) break;

		const upper = command.toUpperCase();
		const relative = command !== upper;

		if (upper === "Z") {
			current = start;
			points.push(current);
			command = "";
			continue;
		}

		const count =
			upper === "H" || upper === "V"
				? 1
				: upper === "Q" || upper === "S"
					? 4
					: upper === "C"
						? 6
						: upper === "A"
							? 7
							: 2;
		const values = read(count);

		if (!values) {
			command = "";
			continue;
		}

		if (upper === "M" || upper === "L") {
			current = point(values[0], values[1], relative);
			points.push(current);

			if (upper === "M") {
				start = current;
				command = relative ? "l" : "L";
			}
		} else if (upper === "H") {
			current = { x: relative ? current.x + values[0] : values[0], y: current.y };
			points.push(current);
		} else if (upper === "V") {
			current = { x: current.x, y: relative ? current.y + values[0] : values[0] };
			points.push(current);
		} else if (upper === "Q" || upper === "T") {
			const control: Point =
				upper === "T"
					? quadratic
						? reflect(quadratic, current)
						: current
					: point(values[0], values[1], relative);
			const end = upper === "T" ? point(values[0], values[1], relative) : point(values[2], values[3], relative);

			sampleQuadratic(points, current, control, end);
			current = end;
			quadratic = control;
			cubic = null;
		} else if (upper === "C" || upper === "S") {
			const a =
				upper === "S" ? (cubic ? reflect(cubic, current) : current) : point(values[0], values[1], relative);
			const b = upper === "S" ? point(values[0], values[1], relative) : point(values[2], values[3], relative);
			const end = upper === "S" ? point(values[2], values[3], relative) : point(values[4], values[5], relative);

			sampleCubic(points, current, a, b, end);
			current = end;
			cubic = b;
			quadratic = null;
		} else if (upper === "A") {
			const end = point(values[5], values[6], relative);
			const rx = Math.abs(values[0]);
			const ry = Math.abs(values[1]);

			points.push(current, end, { x: end.x - rx, y: end.y - ry }, { x: end.x + rx, y: end.y + ry });
			current = end;
		}
	}

	if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };

	const xs = points.map((entry) => entry.x);
	const ys = points.map((entry) => entry.y);
	const x = Math.min(...xs);
	const y = Math.min(...ys);

	return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
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

function reflect(point: Point, around: Point): Point {
	return { x: around.x * 2 - point.x, y: around.y * 2 - point.y };
}

function sampleQuadratic(points: Point[], start: Point, control: Point, end: Point): void {
	for (let step = 0; step <= pathBoundsSteps; step += 1) {
		const t = step / pathBoundsSteps;
		const inverse = 1 - t;

		points.push({
			x: inverse * inverse * start.x + 2 * inverse * t * control.x + t * t * end.x,
			y: inverse * inverse * start.y + 2 * inverse * t * control.y + t * t * end.y
		});
	}
}

function sampleCubic(points: Point[], start: Point, a: Point, b: Point, end: Point): void {
	for (let step = 0; step <= pathBoundsSteps; step += 1) {
		const t = step / pathBoundsSteps;
		const inverse = 1 - t;

		points.push({
			x: inverse ** 3 * start.x + 3 * inverse ** 2 * t * a.x + 3 * inverse * t ** 2 * b.x + t ** 3 * end.x,
			y: inverse ** 3 * start.y + 3 * inverse ** 2 * t * a.y + 3 * inverse * t ** 2 * b.y + t ** 3 * end.y
		});
	}
}
