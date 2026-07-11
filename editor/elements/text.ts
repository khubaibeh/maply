import type { TextElement } from "@maply/model/types";

/** Estimates text bounds without browser canvas measurement. */
export function getTextBounds(element: TextElement) {
	return {
		x: Math.round(element.x),
		y: Math.round(element.y - element.fontSize),
		width: Math.max(1, Math.round(element.width)),
		height: Math.max(1, Math.round(element.height))
	};
}
