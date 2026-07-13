import type { Canvas, Point } from "@maply/model/types";

/** Active path-drawing interaction state. */
export type PathSession = { points: Point[]; current: Point; nearFirst: boolean };

/** Clamps a point to the canvas rectangle. */
export function clampToCanvas(point: Point, canvas: Canvas): Point {
	return {
		x: Math.max(canvas.x, Math.min(canvas.x + canvas.width, point.x)),
		y: Math.max(canvas.y, Math.min(canvas.y + canvas.height, point.y))
	};
}

/** Clips a segment endpoint to the first canvas edge crossed from its start. */
export function clampAlongSegment(start: Point, point: Point, canvas: Canvas): Point {
	if (
		point.x >= canvas.x &&
		point.x <= canvas.x + canvas.width &&
		point.y >= canvas.y &&
		point.y <= canvas.y + canvas.height
	)
		return point;

	const dx = point.x - start.x;
	const dy = point.y - start.y;
	let maxT = 1;
	if (dx > 0) maxT = Math.min(maxT, (canvas.x + canvas.width - start.x) / dx);
	else if (dx < 0) maxT = Math.min(maxT, (canvas.x - start.x) / dx);
	if (dy > 0) maxT = Math.min(maxT, (canvas.y + canvas.height - start.y) / dy);
	else if (dy < 0) maxT = Math.min(maxT, (canvas.y - start.y) / dy);
	const t = Math.max(0, maxT);
	return { x: start.x + dx * t, y: start.y + dy * t };
}

/** Advances path preview state with optional segment snapping. */
export function movePath(
	session: PathSession,
	point: Point,
	canvas: Canvas,
	closeThreshold: number,
	snap?: (start: Point, end: Point) => Point
): PathSession {
	const clamped = clampToCanvas(point, canvas);
	const last = session.points.at(-1);
	const candidate = last && snap ? snap(last, clamped) : clamped;
	const current = last ? clampAlongSegment(last, candidate, canvas) : candidate;
	const first = session.points[0];
	const nearFirst = first ? Math.hypot(first.x - current.x, first.y - current.y) <= closeThreshold : false;
	return { ...session, current, nearFirst };
}
