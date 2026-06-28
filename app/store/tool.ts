import { get, writable } from "svelte/store";

import type { Tool } from "../domain/tools";

type ToolState = {
	activeTool: Tool;
	previousTool: Tool | null;
	isSpacePressed: boolean;
};

const store = writable<ToolState>({
	activeTool: "select",
	previousTool: null,
	isSpacePressed: false
});

export const appToolState = {
	subscribe: store.subscribe,

	setTool(tool: Tool) {
		store.update((state) => ({ ...state, activeTool: tool }));
	},

	setSpacePressed(value: boolean) {
		// Space temporarily switches to hand mode and restores the previous tool on release.
		const state = get(store);

		if (value) {
			store.set({
				activeTool: state.activeTool === "hand" ? state.activeTool : "hand",
				previousTool: state.activeTool === "hand" ? state.previousTool : state.activeTool,
				isSpacePressed: true
			});
			return;
		}

		store.set({
			activeTool: state.previousTool ?? state.activeTool,
			previousTool: null,
			isSpacePressed: false
		});
	}
};
