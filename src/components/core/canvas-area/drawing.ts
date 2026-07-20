import type { Point } from "@maply/model/types";

/** Tools that create an element from a pointer drag. */
export type DrawingTool = "rect" | "circle" | "text" | "image";

/** Active shape-drawing interaction state. */
export type DrawingSession = { tool: DrawingTool; start: Point; current: Point; square: boolean };

/** Returns whether a tool creates a shape from a drag box. */
export function isDrawingTool(tool: string): tool is DrawingTool {
	return tool === "rect" || tool === "circle" || tool === "text" || tool === "image";
}
