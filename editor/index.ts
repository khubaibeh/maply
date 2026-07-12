import { readonly } from "svelte/store";

import { centerCamera, pan, resetCamera, resetZoom, setCamera, zoomIn, zoomOut } from "./canvas/camera";
import { setColor, setFrame, setPosition, setSize } from "./canvas/commands";
import { setSpacePressed, setTool } from "./canvas/tool";
import { copy, getClipboard, paste } from "./compat/clipboard";
import {
	clampElementsToCanvas,
	resizeElementByHandle,
	setElementPosition,
	translateElement,
	translateElements
} from "./compat/elements";
import { getElementBounds, getImageRenderRect, getPathDataBounds, getPathRenderTransform } from "./compat/geometry";
import { resizeImageCropFrame } from "./compat/image";
import { validateElementNames } from "./compat/naming";
import { snapPathSegment } from "./compat/path";
import { create, exportProject, exportSvg, importProject, importSvg } from "./compat/project";
import { flushEditorSave, loadEditorSession, queueEditorSave } from "./compat/session";
import {
	getTextLayoutMetrics,
	getWrappedTextLineHeight,
	getWrappedTextLines,
	getWrappedTextMetrics
} from "./compat/text";
import { imageFromFile, replaceImageAsset } from "./compat/upload";
import { circleFromDrag, imageFromDrag, pathFromPoints, rectFromDrag, textFromDrag } from "./elements/create";
import { getShapeDragBox } from "./elements/geometry";
import { addElement, updateElement, updatePathVertex, renameElement } from "./elements/mutate";
import { autofixElementName } from "./elements/naming";
import { toPathPoints } from "./elements/path";
import { resetImageCrop, setImageCropScale, translateImageCrop } from "./image/commands";
import { rename } from "./project/commands";
import { select, selectAll, setHover, toggleCrop } from "./selection/commands";
import { deleteElements } from "./selection/delete";
import { moveBackward, moveForward, moveToBack, moveToFront, reorder } from "./selection/ordering";
import { imageAssetState } from "./state/assets";
import { fillState, projectState } from "./state/document";
import { toolState, canvasState, zoomLimits } from "./state/workspace";

function setFill(fill: string): void {
	fillState.set(fill);
}

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

	limits: { zoom: zoomLimits },

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
		translateAll: translateElements,
		setPosition: setElementPosition,
		resize: resizeElementByHandle,
		update: updateElement,
		rename: renameElement,
		updatePathVertex,
		clampAll: clampElementsToCanvas
	},

	selection: { select, selectAll, setHover, toggleCrop },

	naming: { validate: validateElementNames, autofix: autofixElementName },

	fill: { set: setFill },

	geometry: {
		shapeDragBox: getShapeDragBox,
		elementBounds: getElementBounds,
		pathPoints: toPathPoints,
		pathBounds: getPathDataBounds,
		pathRenderTransform: getPathRenderTransform,
		snapPathSegment,
		imageRenderRect: getImageRenderRect
	},

	text: {
		wrappedLines: getWrappedTextLines,
		wrappedLineHeight: getWrappedTextLineHeight,
		wrappedMetrics: getWrappedTextMetrics,
		layoutMetrics: getTextLayoutMetrics
	},

	clipboard: { copy, get: getClipboard, paste },

	image: {
		translateCrop: translateImageCrop,
		setCropScale: setImageCropScale,
		resetCrop: resetImageCrop,
		resizeFrame: resizeImageCropFrame,
		replace: replaceImageAsset,
		fromFile: imageFromFile
	},

	project: { rename, create, export: exportProject, import: importProject, exportSvg, importSvg },

	create: { rectFromDrag, circleFromDrag, textFromDrag, imageFromDrag, pathFromPoints },

	save: {
		queue: queueEditorSave,
		flush: flushEditorSave
	}
} as const;

export type EditorApi = typeof Editor;
export type { ResizeHandle, ResizeOptions } from "./elements/resize";
export type { ElementNameIssue, ElementNameValidation } from "./compat/naming";
