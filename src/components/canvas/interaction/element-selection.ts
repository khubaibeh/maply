import type { Element } from "@maply/model/types";

/** Describes how a canvas pointer-down should treat an element's selection state. */
export function canvasElementPointerAction(element: Pick<Element, "locked">): "interact" | "clear-selection" {
	return element.locked ? "clear-selection" : "interact";
}

/** Returns whether an element accepts selection interactions from the canvas. */
export function canSelectOnCanvas(element: Pick<Element, "locked">): boolean {
	return canvasElementPointerAction(element) === "interact";
}
