import type { Tool } from "./schema";

export const drawingTools: readonly Tool[] = ["rect", "circle", "path", "text", "image"];

export function isDrawingTool(tool: Tool): boolean {
	return drawingTools.includes(tool);
}
