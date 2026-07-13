import type { ResizeHandle } from "editor/types";

/** Axis-aligned rectangle used to position resize anchors. */
export type HandleBounds = { x: number; y: number; width: number; height: number };

/** One directional resize anchor in SVG coordinates. */
export type ResizeAnchor = { key: ResizeHandle; x: number; y: number };

/** Returns the eight directional anchors around an axis-aligned rectangle. */
export function resizeAnchors(bounds: HandleBounds): ResizeAnchor[] {
	const { x, y, width, height } = bounds;
	return [
		{ key: "nw", x, y },
		{ key: "n", x: x + width / 2, y },
		{ key: "ne", x: x + width, y },
		{ key: "e", x: x + width, y: y + height / 2 },
		{ key: "se", x: x + width, y: y + height },
		{ key: "s", x: x + width / 2, y: y + height },
		{ key: "sw", x, y: y + height },
		{ key: "w", x, y: y + height / 2 }
	];
}
