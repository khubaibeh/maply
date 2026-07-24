import type { ElementType } from "./schema";

/** Returns the default SVG binding state for a newly decoded element type. */
export function defaultBindable(type: ElementType): boolean {
	return type === "rect" || type === "circle" || type === "path";
}
