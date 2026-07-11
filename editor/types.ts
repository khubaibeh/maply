import type { Camera, Element, ImportExportState, StoredImageAsset, Tool } from "@maply/model/types";

/** The live project data and editor-only selection state. */
export type ProjectState = {
	id: string;
	name: string;
	elements: Element[];
	importExportState: ImportExportState;
	initialized: boolean;
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
	minZoom: number;
	maxZoom: number;
};

/** The active drawing tool and temporary Space-to-hand state. */
export type ToolState = {
	activeTool: Tool;
	previousTool: Tool | null;
	isSpacePressed: boolean;
};

/** Image assets currently available to the live editor session, keyed by asset ID. */
export type ImageAssetState = Record<string, StoredImageAsset>;
