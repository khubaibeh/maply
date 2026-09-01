import type { Point } from "@maply/model/types";

const angleTieEpsilon = 1e-9;
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

function angularDistance(a: number, b: number): number {
	const delta = Math.abs(a - b);

	return Math.min(delta, Math.PI * 2 - delta);
}
