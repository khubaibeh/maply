export type Tool = "select" | "hand" | "rect" | "circle" | "path" | "text" | "image";

export const drawingTools: readonly Tool[] = ["rect", "circle", "path", "text", "image"];

export function isDrawingTool(tool: Tool): boolean {
	return drawingTools.includes(tool);
}
