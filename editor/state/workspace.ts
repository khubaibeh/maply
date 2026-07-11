import type { CanvasState, ToolState } from "editor/types";
import { writable } from "svelte/store";

const initialCanvasState: CanvasState = {
	width: 800,
	height: 800,
	color: "#ffffff",
	x: 0,
	y: 0,
	camera: { x: 0, y: 0, zoom: 1 },
	minZoom: 0.1,
	maxZoom: 5
};

/** The editor's live canvas frame and viewport state. */
export const canvasState = writable<CanvasState>(initialCanvasState);

const initialToolState: ToolState = {
	activeTool: "select",
	previousTool: null,
	isSpacePressed: false
};

/** The editor's active tool and temporary Space-to-hand state. */
export const toolState = writable<ToolState>(initialToolState);
