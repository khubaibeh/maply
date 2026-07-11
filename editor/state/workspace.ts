import { writable } from "svelte/store";

import type { CanvasState, ToolState } from "../types";

/** The fixed camera scale range: 0.1 is 10% and 5 is 500% of canvas pixels. */
export const zoomLimits = { min: 0.1, max: 5 } as const;

/** Creates a fresh workspace canvas state without retaining a prior session's values. */
export function createInitialCanvasState(): CanvasState {
	return {
		width: 800,
		height: 800,
		color: "#ffffff",
		x: 0,
		y: 0,
		camera: { x: 0, y: 0, zoom: 1 }
	};
}

/** The editor's live canvas frame and viewport state. */
export const canvasState = writable<CanvasState>(createInitialCanvasState());

const initialToolState: ToolState = {
	activeTool: "select",
	previousTool: null,
	isSpacePressed: false
};

/** The editor's active tool and temporary Space-to-hand state. */
export const toolState = writable<ToolState>(initialToolState);
