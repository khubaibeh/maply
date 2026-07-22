import type { Element } from "@maply/model/types";

/** Returns whether an element accepts selection interactions from the canvas. */
export function canSelectOnCanvas(element: Pick<Element, "locked">): boolean {
	return !element.locked;
}
