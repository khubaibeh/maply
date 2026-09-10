import type { Project, StoredImageAsset } from "@maply/model/types";

import { getEditorBenchmarkCounters, resetEditorBenchmarkCounters } from "./benchmark-counters";
import { history } from "./history";
import { runStorageEffect, saveImageAssetEffect } from "./session/coordinator";
import { imageAssetState } from "./state/assets";
import { updateProjectState } from "./state/document";
import { resetInteractionState } from "./state/interaction";
import { canvasState } from "./state/workspace";

/** Applies a cold benchmark fixture through the editor's public benchmark seam. */
export function applyBenchmarkFixture(project: Project, imageAssets: readonly StoredImageAsset[], zoom: number): void {
	canvasState.set({
		width: project.canvas.width,
		height: project.canvas.height,
		color: project.canvas.color,
		x: project.canvas.x,
		y: project.canvas.y,
		camera: { x: 0, y: 0, zoom }
	});
	imageAssetState.set(Object.fromEntries(imageAssets.map((asset) => [asset.id, asset])));
	updateProjectState(
		(state) => ({
			...state,
			id: project.id,
			name: project.name,
			elements: [...project.elements],
			initialized: true
		}),
		"rescan"
	);
	resetInteractionState();
	history.reset();
}

/** Persists the bounded fixture assets before a measured load scenario. */
export async function persistBenchmarkAssets(assets: readonly StoredImageAsset[]): Promise<void> {
	for (const asset of assets) await runStorageEffect(saveImageAssetEffect(asset));
}

/** Resets benchmark counters before one measured scenario. */
export function resetBenchmarkCounters(): void {
	resetEditorBenchmarkCounters();
}

/** Reads benchmark counters after one measured scenario. */
export function getBenchmarkCounters() {
	return getEditorBenchmarkCounters();
}
