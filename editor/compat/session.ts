import type { Element, Project } from "@maply/model/types";
import { storage } from "@maply/storage";
import { get } from "svelte/store";

import { clampZoom } from "../canvas/camera";
import { imageAssetState } from "../state/assets";
import { projectState } from "../state/document";
import { canvasState, createInitialCanvasState } from "../state/workspace";
import { clampElementToCanvas } from "./geometry";
import { normalizeElement } from "./normalize";
import { importExportState } from "./project-state";

const defaultProjectId = "prod";
let saveTimeout: ReturnType<typeof setTimeout> | null = null;

function assetIds(elements: readonly Element[]) {
	return elements.flatMap((element) => (element.type === "image" && element.assetId ? [element.assetId] : []));
}

function currentProject(): Project {
	const project = get(projectState);
	const canvas = get(canvasState);
	return {
		id: project.id,
		name: project.name,
		canvas: { width: canvas.width, height: canvas.height, color: canvas.color, x: canvas.x, y: canvas.y },
		camera: { ...canvas.camera },
		elements: project.elements.map((element) => ({ ...element })),
		importExportState: { ...get(importExportState) }
	};
}

export async function loadEditorSession(projectId = defaultProjectId): Promise<void> {
	projectState.update((state) => ({ ...state, id: projectId, initialized: false }));
	const result = await storage.project.fetch(projectId);
	if (!result.ok) {
		console.warn("Failed to load project, using defaults:", result.error);
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

	const project = result.value;
	const initial = createInitialCanvasState();
	canvasState.set({
		...initial,
		...project.canvas,
		camera: project.camera ? { ...project.camera, zoom: clampZoom(project.camera.zoom) } : initial.camera
	});
	importExportState.set({ ...project.importExportState });
	projectState.update((state) => ({
		...state,
		id: project.id,
		name: project.name,
		elements: project.elements.map((element) => clampElementToCanvas(normalizeElement(element), project.canvas)),
		selectedElementId: null,
		selectedElementIds: [],
		hoveredElementId: null,
		cropEditingElementId: null
	}));

	const assets = await storage.imageAsset.fetch(assetIds(project.elements));
	if (!assets.ok) {
		console.warn("Failed to load image assets:", assets.error);
		imageAssetState.set({});
	} else {
		imageAssetState.set(Object.fromEntries(assets.value.map((asset) => [asset.id, asset])));
	}
	projectState.update((state) => ({ ...state, initialized: true }));
}

async function saveCurrentProject(): Promise<void> {
	const result = await storage.project.save(currentProject());
	if (!result.ok) console.warn("Failed to save project:", result.error);
}

export function queueEditorSave(): void {
	if (!get(projectState).initialized) return;
	if (saveTimeout) clearTimeout(saveTimeout);
	saveTimeout = setTimeout(() => void saveCurrentProject(), 500);
}

export async function flushEditorSave(): Promise<void> {
	if (!get(projectState).initialized) return;
	if (saveTimeout) clearTimeout(saveTimeout);
	saveTimeout = null;
	await saveCurrentProject();
}
