import type { Camera, Element, ElementNameGrid, StoredImageAsset, Tool } from "@maply/model/types";

export type { ElementNameIssue, ElementNameValidation } from "./elements/naming";
export type { ResizeHandle, ResizeOptions } from "./elements/resize";

/** A layer-order direction for one or more selected elements. */
export type SelectionOrder = "front" | "forward" | "backward" | "back";

/** The live persisted project data. */
export type ProjectState = {
	id: string;
	name: string;
	elements: Element[];
	elementNameGrid: ElementNameGrid;
	isElementNameImportOpen: boolean;
	initialized: boolean;
};

/** Selection, hover, and crop state that never crosses the persistence seam. */
export type InteractionState = {
	selectedElementId: string | null;
	selectedElementIds: string[];
	hoveredElementId: string | null;
	cropEditingElementId: string | null;
};

/** The live canvas frame and viewport state. */
export type CanvasState = {
	width: number;
	height: number;
	color: string;
	x: number;
	y: number;
	camera: Camera;
};

/** The active drawing tool and temporary Space-to-hand state. */
export type ToolState = {
	activeTool: Tool;
	previousTool: Tool | null;
	isSpacePressed: boolean;
	isCanvasResizing: boolean;
};

/** Image assets currently available to the live editor session, keyed by asset ID. */
export type ImageAssetState = Record<string, StoredImageAsset>;
