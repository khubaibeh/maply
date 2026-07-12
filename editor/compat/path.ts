import type { Point } from "@maply/model/types";

const angleTieEpsilon = 1e-9;

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

/** Legacy path-segment snapping used by the current Svelte path drawing UI. */
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
