import type { Element, Project } from "@maply/model/types";
import { storage } from "@maply/storage";

import { clampZoom } from "../canvas/camera";
import { clampElementToCanvas } from "../elements/geometry";
import { imageAssetState } from "../state/assets";
import { projectState } from "../state/document";
import { canvasState, createInitialCanvasState } from "../state/workspace";
import { normalizeElement } from "./normalize";

const defaultProjectId = "prod";

function imageAssetIds(elements: readonly Element[]) {
	return elements.flatMap((element) => (element.type === "image" && element.assetId ? [element.assetId] : []));
}

function applyProject(project: Project) {
	const canvas = createInitialCanvasState();

	canvasState.set({
		...canvas,
		width: project.canvas.width,
		height: project.canvas.height,
		color: project.canvas.color,
		x: project.canvas.x,
		y: project.canvas.y,
		camera: project.camera ? { ...project.camera, zoom: clampZoom(project.camera.zoom) } : { x: 0, y: 0, zoom: 1 }
	});

	projectState.update((state) => ({
		...state,
		id: project.id,
		name: project.name,
		elements: project.elements.map((element) => clampElementToCanvas(normalizeElement(element), project.canvas)),
		// TODO: This single one needs to go away at a later time, this is code smell
		selectedElementId: null,
		selectedElementIds: [],
		hoveredElementId: null,
		cropEditingElementId: null
	}));
}

/** Hydrates editor state and its referenced image assets from persistent storage. */
export async function loadEditorSession(projectId = defaultProjectId): Promise<void> {
	projectState.update((state) => ({ ...state, id: projectId, initialized: false }));

	const projectResult = await storage.project.fetch(projectId);
	if (!projectResult.ok) {
		console.warn("Failed to load project, using defaults:", projectResult.error);
		imageAssetState.set({});
		projectState.update((state) => ({
			...state,
			selectedElementId: null,
			selectedElementIds: [],
			hoveredElementId: null,
			cropEditingElementId: null,
			initialized: true
		}));
		return;
	}

	applyProject(projectResult.value);

	const assetsResult = await storage.imageAsset.fetch(imageAssetIds(projectResult.value.elements));
	if (!assetsResult.ok) {
		console.warn("Failed to load image assets:", assetsResult.error);
		imageAssetState.set({});
	} else {
		imageAssetState.set(Object.fromEntries(assetsResult.value.map((asset) => [asset.id, asset])));
	}

	projectState.update((state) => ({ ...state, initialized: true }));
}
