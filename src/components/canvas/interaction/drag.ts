import type { Point } from "@maply/model/types";

/** Coordinate information supplied for one pointer-drag movement. */
export type DragMove = {
	current: Point;
	delta: Point;
	totalDelta: Point;
	event: PointerEvent;
};

/** Computes both incremental and pointer-down-relative movement. */
export function measureDrag(start: Point, previous: Point, current: Point) {
	return {
		delta: { x: current.x - previous.x, y: current.y - previous.y },
		totalDelta: { x: current.x - start.x, y: current.y - start.y }
	};
}
