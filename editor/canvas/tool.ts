import type { Tool } from "@maply/model/types";

import { toolState } from "../state/workspace";

/** Selects the active editor tool. */
export function setTool(tool: Tool): void {
	toolState.update((state) => ({ ...state, activeTool: tool }));
}

/** Temporarily switches to Hand while Space is held and restores the prior tool on release. */
export function setSpacePressed(isPressed: boolean): void {
	toolState.update((state) => {
		if (isPressed) {
			return {
				...state,
				activeTool: state.activeTool === "hand" ? state.activeTool : "hand",
				previousTool: state.activeTool === "hand" ? state.previousTool : state.activeTool,
				isSpacePressed: true
			};
		}

		return {
			...state,
			activeTool: state.previousTool ?? state.activeTool,
			previousTool: null,
			isSpacePressed: false
		};
	});
}

/** Tracks whether the canvas frame is actively being resized. */
export function setCanvasResizing(isCanvasResizing: boolean): void {
	toolState.update((state) => (state.isCanvasResizing === isCanvasResizing ? state : { ...state, isCanvasResizing }));
}
