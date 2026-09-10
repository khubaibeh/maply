import { copyProjectEditorData } from "@maply/model";
import type { Element } from "@maply/model/types";
import type { StoredEditorProject } from "@maply/storage/types";
import { Effect, MutableRef } from "effect";

import { clampZoom } from "../canvas/camera";
import { clampElementToCanvas } from "../elements/geometry";
import { history } from "../history";
import { imageAssetState } from "../state/assets";
import { updateProjectState } from "../state/document";
import { applyInternalEditorMutationEffect, withEditorMutationBlockEffect } from "../state/editing";
import { resetInteractionState } from "../state/interaction";
import { canvasState, createInitialCanvasState } from "../state/workspace";
import { fetchImageAssetsEffect, fetchProjectEffect, runStorageEffect, withEditorWriteGate } from "./coordinator";
import { SessionSuperseded } from "./errors";
import { normalizeElement } from "./normalize";

const defaultProjectId = "prod";
const latestLoadRequest = MutableRef.make(0);

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
			isElementNameImportOpen: project.isElementNameImportOpen
		}),
		"rescan"
	);
	resetInteractionState();
}

/** Hydrates editor state and its referenced image assets from persistent storage. */
export async function loadEditorSession(projectId = defaultProjectId): Promise<void> {
	return runStorageEffect(
		withEditorMutationBlockEffect(
			loadEditorSessionEffect(projectId).pipe(Effect.catchTag("SessionSuperseded", () => Effect.void))
		)
	);
}

/** Effect workflow that hydrates one project while the caller owns the mutation block. */
export const loadEditorSessionEffect = Effect.fn("editor.session.load")(function* (projectId: string) {
	const request = MutableRef.updateAndGet(latestLoadRequest, (value) => value + 1);
	yield* history.settleEffect;
	if (request !== MutableRef.get(latestLoadRequest)) return yield* Effect.fail(new SessionSuperseded({}));
	yield* Effect.sync(history.reset);
	yield* history.withoutRecordingEffect(
		Effect.gen(function* () {
			yield* applyInternalEditorMutationEffect(
				Effect.sync(() => {
					updateProjectState((state) => ({ ...state, id: projectId, initialized: false }), "preserve");
				})
			);

			const loaded = yield* withEditorWriteGate(
				Effect.gen(function* () {
					const projectResult = yield* Effect.result(fetchProjectEffect(projectId));
					if (projectResult._tag === "Failure") return { projectResult, assetsResult: null };
					const project = projectResult.success;
					const assetsResult = yield* Effect.result(fetchImageAssetsEffect(imageAssetIds(project.elements)));
					return { projectResult, assetsResult };
				})
			);
			if (request !== MutableRef.get(latestLoadRequest)) return yield* Effect.fail(new SessionSuperseded({}));
			const { projectResult, assetsResult } = loaded;
			if (projectResult._tag === "Failure") {
				console.warn("Failed to load project, using defaults:", projectResult.failure.cause);
				yield* applyInternalEditorMutationEffect(
					Effect.sync(() => {
						imageAssetState.set({});
						updateProjectState(
							(state) => ({
								...state,
								initialized: true
							}),
							"preserve"
						);
						resetInteractionState();
					})
				);
				return;
			}

			const project = projectResult.success;

			yield* applyInternalEditorMutationEffect(
				Effect.sync(() => {
					applyProject(project);
					if (!assetsResult || assetsResult._tag === "Failure") {
						if (assetsResult) console.warn("Failed to load image assets:", assetsResult.failure.cause);
						imageAssetState.set({});
					} else {
						imageAssetState.set(Object.fromEntries(assetsResult.success.map((asset) => [asset.id, asset])));
					}

					updateProjectState((state) => ({ ...state, initialized: true }), "preserve");
				})
			);
		})
	);
});
