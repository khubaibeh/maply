import { loadEditorSession } from "editor/session/load";
import { flushEditorSave, queueEditorSave } from "editor/session/save";
import { imageAssetState } from "editor/state/assets";
import { fillState, projectState } from "editor/state/document";
import { toolState, canvasState } from "editor/state/workspace";
import { readonly } from "svelte/store";

/** Maply's application-specific editing composition boundary. */
export const Editor = {
	load(projectId?: string) {
		return loadEditorSession(projectId);
	},

	state: {
		project: readonly(projectState),
		canvas: readonly(canvasState),
		fill: readonly(fillState),
		tool: readonly(toolState),
		imageAssets: readonly(imageAssetState)
	},

	save: {
		queue() {
			queueEditorSave();
		},

		flush() {
			return flushEditorSave();
		}
	}
} as const;

export type EditorApi = typeof Editor;
