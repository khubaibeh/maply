import type { Point } from "@maply/model/types";

export type MarqueeBounds = {
	x: number;
	y: number;
	width: number;
	height: number;
};

/** Returns a positive-size box for a drag in any direction. */
export function getMarqueeBounds(start: Point, end: Point): MarqueeBounds {
	return {
		x: Math.min(start.x, end.x),
		y: Math.min(start.y, end.y),
		width: Math.abs(end.x - start.x),
		height: Math.abs(end.y - start.y)
	};
}

/** Returns whether an element's bounds overlap the marquee. */
export function intersectsBounds(marquee: MarqueeBounds, bounds: MarqueeBounds): boolean {
	return (
		bounds.x <= marquee.x + marquee.width &&
		bounds.x + bounds.width >= marquee.x &&
		bounds.y <= marquee.y + marquee.height &&
		bounds.y + bounds.height >= marquee.y
	);
}

/** Returns whether movement exceeds a screen-space marquee threshold. */
export function exceedsMarqueeThreshold(delta: Point, zoom: number, threshold: number): boolean {
	return Math.hypot(delta.x, delta.y) * zoom >= threshold;
}

/** Resolves selection IDs for a completed marquee, or null when the drag was cancelled. */
export function resolveMarqueeSelection(
	selectedIds: readonly string[],
	candidateIds: readonly string[],
	additive: boolean,
	didDrag: boolean,
	cancelled: boolean
): string[] | null {
	if (cancelled) return null;
	if (!didDrag) return additive ? [...selectedIds] : [];
	return additive ? [...new Set([...selectedIds, ...candidateIds])] : [...candidateIds];
}
