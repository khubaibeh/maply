import type { Point } from "@maply/model/types";

const angleTieEpsilon = 1e-9;
const boundsSteps = 32;
const tokenPattern = /[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?/g;

type SnapDirection = { x: number; y: number; diagonal: boolean };

const snapDirections: readonly SnapDirection[] = [
	{ x: 1, y: 0, diagonal: false },
	{ x: Math.SQRT1_2, y: Math.SQRT1_2, diagonal: true },
	{ x: 0, y: 1, diagonal: false },
	{ x: -Math.SQRT1_2, y: Math.SQRT1_2, diagonal: true },
	{ x: -1, y: 0, diagonal: false },
	{ x: -Math.SQRT1_2, y: -Math.SQRT1_2, diagonal: true },
	{ x: 0, y: -1, diagonal: false },
	{ x: Math.SQRT1_2, y: -Math.SQRT1_2, diagonal: true }
] as const;

/** Parses editable linear SVG path commands into absolute vertices. */
export function toPathPoints(d: string): Point[] {
	const tokens = d.match(tokenPattern) ?? [];
	const points: Point[] = [];

	let index = 0;
	let command = "";
	let current = { x: 0, y: 0 };

	while (index < tokens.length) {
		if (/^[a-zA-Z]$/.test(tokens[index])) command = tokens[index++];
		if (!command) return [];

		const upper = command.toUpperCase();
		if (upper === "Z") break;

		const count = upper === "H" || upper === "V" ? 1 : 2;
		const values = tokens.slice(index, index + count).map(Number);

		if (values.length !== count || values.some((value) => !Number.isFinite(value))) return [];
		index += count;

		const relative = command !== upper;

		if (upper === "H") {
			current = { ...current, x: relative ? current.x + values[0] : values[0] };
		} else if (upper === "V") {
			current = { ...current, y: relative ? current.y + values[0] : values[0] };
		} else if (upper === "M" || upper === "L") {
			current = {
				x: relative ? current.x + values[0] : values[0],
				y: relative ? current.y + values[1] : values[1]
			};
		} else {
			return [];
		}

		points.push(current);

		if (upper === "M") command = relative ? "l" : "L";
	}

	return points;
}

/** Serializes linear path vertices into canonical SVG path data. */
export function toPath(points: readonly Point[], closed: boolean): string {
	if (points.length === 0) return "";

	const [first, ...rest] = points;
	const segments = rest.map((p) => ` L${Math.round(p.x)},${Math.round(p.y)}`);

	return `M${Math.round(first.x)},${Math.round(first.y)}${segments.join("")}${closed ? " Z" : ""}`;
}

/** Tolerantly approximates bounds for rendered SVG paths, including curves and arcs. */
export function getSvgPathBounds(path: string) {
	const tokens = path.match(tokenPattern) ?? [];
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

/** Snaps a path segment to the nearest cardinal or diagonal direction. */
export function snapPathSegment(anchor: Point, point: Point): Point {
	const dx = point.x - anchor.x;
	const dy = point.y - anchor.y;
	if (dx === 0 && dy === 0) return point;

	const angle = Math.atan2(dy, dx);
	let best = snapDirections[0];
	let bestDistance = Infinity;

	for (const direction of snapDirections) {
		const distance = angularDistance(angle, Math.atan2(direction.y, direction.x));
		if (
			distance < bestDistance - angleTieEpsilon ||
			(Math.abs(distance - bestDistance) <= angleTieEpsilon && direction.diagonal && !best.diagonal)
		) {
			best = direction;
			bestDistance = distance;
		}
	}

	const length = dx * best.x + dy * best.y;
	return { x: anchor.x + best.x * length, y: anchor.y + best.y * length };
}

function reflect(point: Point, around: Point): Point {
	return { x: around.x * 2 - point.x, y: around.y * 2 - point.y };
}

function sampleQuadratic(points: Point[], start: Point, control: Point, end: Point): void {
	for (let step = 0; step <= boundsSteps; step += 1) {
		const t = step / boundsSteps;
		const inverse = 1 - t;

		points.push({
			x: inverse * inverse * start.x + 2 * inverse * t * control.x + t * t * end.x,
			y: inverse * inverse * start.y + 2 * inverse * t * control.y + t * t * end.y
		});
	}
}

function sampleCubic(points: Point[], start: Point, a: Point, b: Point, end: Point): void {
	for (let step = 0; step <= boundsSteps; step += 1) {
		const t = step / boundsSteps;
		const inverse = 1 - t;

		points.push({
			x: inverse ** 3 * start.x + 3 * inverse ** 2 * t * a.x + 3 * inverse * t ** 2 * b.x + t ** 3 * end.x,
			y: inverse ** 3 * start.y + 3 * inverse ** 2 * t * a.y + 3 * inverse * t ** 2 * b.y + t ** 3 * end.y
		});
	}
}

function angularDistance(a: number, b: number): number {
	const delta = Math.abs(a - b);

	return Math.min(delta, Math.PI * 2 - delta);
}
