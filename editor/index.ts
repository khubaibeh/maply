import { getImageRenderRect } from "@maply/model";
import { readonly } from "svelte/store";

import { centerCamera, pan, resetCamera, resetZoom, setCamera, zoomIn, zoomOut } from "./canvas/camera";
import { setColor, setFrame, setPosition, setSize } from "./canvas/commands";
import { setCanvasResizing, setSpacePressed, setTool } from "./canvas/tool";
import { circleFromDrag, imageFromDrag, pathFromPoints, rectFromDrag, textFromDrag } from "./elements/create";
import {
	getElementBounds,
	getElementsBounds,
	getPathRenderTransform,
	getPointBounds,
	getShapeDragBox
} from "./elements/geometry";
import {
	addElement,
	clampElementsToCanvas,
	resizeElementByHandle,
	setElementPosition,
	translateElement,
	translateElements,
	updateElement,
	updateElements,
	updatePathVertex,
	renameElement
} from "./elements/mutate";
import { autofixElementName, validateElementNames } from "./elements/naming";
import { snapPathSegment, toPathPoints } from "./elements/path";
import {
	getTextLayoutMetrics,
	getWrappedTextLineHeight,
	getWrappedTextLines,
	getWrappedTextMetrics
} from "./elements/text";
import { resetImageCrop, resizeImageCropFrame, setImageCropScale, translateImageCrop } from "./image/commands";
import { imageFromFile, replaceImageAsset } from "./image/upload";
import { create, rename } from "./project/commands";
import { exportProject } from "./project/export";
import { importProject } from "./project/import";
import { exportSvg, importSvg } from "./project/svg";
import { copy, getClipboard, paste } from "./selection/clipboard";
import { select, selectAll, selectMany, setHover, toggleCrop } from "./selection/commands";
import { deleteElements } from "./selection/delete";
import { moveBackward, moveForward, moveToBack, moveToFront, reorder } from "./selection/ordering";
import { loadEditorSession } from "./session/load";
import { flushEditorSave, queueEditorSave } from "./session/save";
import { imageAssetState } from "./state/assets";
import { fillState, minimumCanvasSizeState, projectState } from "./state/document";
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
		minimumCanvasSize: readonly(minimumCanvasSizeState),
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
			setSpacePressed,
			setCanvasResizing
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
		updateAll: updateElements,
		rename: renameElement,
		updatePathVertex,
		clampAll: clampElementsToCanvas
	},

	selection: { select, selectAll, selectMany, setHover, toggleCrop },

	naming: { validate: validateElementNames, autofix: autofixElementName },

	fill: { set: setFill },

	geometry: {
		shapeDragBox: getShapeDragBox,
		elementBounds: getElementBounds,
		elementsBounds: getElementsBounds,
		pathPoints: toPathPoints,
		pathBounds: getPointBounds,
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
