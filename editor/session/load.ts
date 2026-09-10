import { copyProjectEditorData } from "@maply/model";
import type { Element } from "@maply/model/types";
import { storage } from "@maply/storage";
import type { StoredEditorProject } from "@maply/storage/types";

import { clampZoom } from "../canvas/camera";
import { clampElementToCanvas } from "../elements/geometry";
import { history } from "../history";
import { imageAssetState } from "../state/assets";
import { updateProjectState } from "../state/document";
import { applyInternalEditorMutation, withEditorMutationBlock } from "../state/editing";
import { canvasState, createInitialCanvasState } from "../state/workspace";
import { normalizeElement } from "./normalize";
import { runEditorStorageOperation } from "./save";

const defaultProjectId = "prod";
let latestLoadRequest = 0;

function imageAssetIds(elements: readonly Element[]) {
	return elements.flatMap((element) => (element.type === "image" && element.assetId ? [element.assetId] : []));
}

function applyProject(project: StoredEditorProject) {
	const canvas = createInitialCanvasState();
	const editorData = copyProjectEditorData(project.editorData);

	canvasState.set({
		...canvas,
		width: project.canvas.width,
		height: project.canvas.height,
		color: project.canvas.color,
		x: project.canvas.x,
		y: project.canvas.y,
		camera: project.camera ? { ...project.camera, zoom: clampZoom(project.camera.zoom) } : { x: 0, y: 0, zoom: 1 }
	});

	updateProjectState(
		(state) => ({
			...state,
			id: project.id,
			name: project.name,
			elements: project.elements.map((element) =>
				clampElementToCanvas(normalizeElement(element), project.canvas)
			),
			elementNameGrid: editorData.elementNameGrid,
			isElementNameImportOpen: project.isElementNameImportOpen,
			// TODO: This single one needs to go away at a later time, this is code smell
			selectedElementId: null,
			selectedElementIds: [],
			hoveredElementId: null,
			cropEditingElementId: null
		}),
		"rescan"
	);
}

/** Hydrates editor state and its referenced image assets from persistent storage. */
export async function loadEditorSession(projectId = defaultProjectId): Promise<void> {
	return withEditorMutationBlock(() => loadEditorSessionBlocked(projectId));
}

async function loadEditorSessionBlocked(projectId: string): Promise<void> {
	const request = ++latestLoadRequest;
	await history.settle();
	if (request !== latestLoadRequest) return;
	history.reset();
	await history.withoutRecording(async () => {
		applyInternalEditorMutation(() => {
			updateProjectState((state) => ({ ...state, id: projectId, initialized: false }), "preserve");
		});

		const loaded = await runEditorStorageOperation(async () => {
			const projectResult = await storage.project.fetch(projectId);
			if (!projectResult.ok) return { projectResult, assetsResult: null };
			const assetsResult = await storage.imageAsset.fetch(imageAssetIds(projectResult.value.elements));
			return { projectResult, assetsResult };
		});
		if (request !== latestLoadRequest) return;
		const { projectResult, assetsResult } = loaded;
		if (!projectResult.ok) {
			console.warn("Failed to load project, using defaults:", projectResult.error);
			applyInternalEditorMutation(() => {
				imageAssetState.set({});
				updateProjectState(
					(state) => ({
						...state,
						selectedElementId: null,
						selectedElementIds: [],
						hoveredElementId: null,
						cropEditingElementId: null,
						initialized: true
					}),
					"preserve"
				);
			});
			return;
		}

		applyInternalEditorMutation(() => {
			applyProject(projectResult.value);
			if (!assetsResult?.ok) {
				if (assetsResult) console.warn("Failed to load image assets:", assetsResult.error);
				imageAssetState.set({});
			} else {
				imageAssetState.set(Object.fromEntries(assetsResult.value.map((asset) => [asset.id, asset])));
			}

			updateProjectState((state) => ({ ...state, initialized: true }), "preserve");
		});
	});
}
