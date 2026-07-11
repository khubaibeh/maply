import { readonly } from "svelte/store";

import { centerCamera, pan, resetCamera, resetZoom, setCamera, zoomIn, zoomOut } from "./canvas/camera";
import { setColor, setFrame, setPosition, setSize } from "./canvas/commands";
import { setSpacePressed, setTool } from "./canvas/tool";
import { circleFromDrag, imageFromDrag, pathFromPoints, rectFromDrag, textFromDrag } from "./elements/create";
import {
	addElement,
	clampElementsToCanvas,
	setElementPosition,
	translateElement,
	updateElement
} from "./elements/mutate";
import { copy, getClipboard, paste } from "./selection/clipboard";
import { select, selectAll, setHover, toggleCrop } from "./selection/commands";
import { deleteElements } from "./selection/delete";
import { moveBackward, moveForward, moveToBack, moveToFront, reorder } from "./selection/ordering";
import { loadEditorSession } from "./session/load";
import { flushEditorSave, queueEditorSave } from "./session/save";
import { imageAssetState } from "./state/assets";
import { fillState, projectState } from "./state/document";
import { toolState, canvasState } from "./state/workspace";

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

	actions: {
		canvas: {
			setSize,
			setFrame,
			setColor,
			setPosition,
			setCamera,
			pan,
			zoomIn,
			zoomOut,
			resetZoom,
			resetCamera,
			centerCamera
		},

		tool: {
			set: setTool,
			setSpacePressed
		}
	},

	element: {
		add: addElement,
		delete: deleteElements,
		reorder,
		moveToFront,
		moveForward,
		moveBackward,
		moveToBack,
		translate: translateElement,
		setPosition: setElementPosition,
		update: updateElement,
		clampAll: clampElementsToCanvas
	},

	selection: { select, selectAll, setHover, toggleCrop },

	clipboard: { copy, get: getClipboard, paste },

	create: { rectFromDrag, circleFromDrag, textFromDrag, imageFromDrag, pathFromPoints },

	save: {
		queue: queueEditorSave,
		flush: flushEditorSave
	}
} as const;

export type EditorApi = typeof Editor;
