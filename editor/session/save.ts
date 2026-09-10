import { copyProjectEditorData } from "@maply/model";
import type { StoredImageAsset } from "@maply/model/types";
import { storage } from "@maply/storage";
import type { StoredEditorProject } from "@maply/storage/types";
import { get } from "svelte/store";

import { projectState } from "../state/document";
import { acquireMutex } from "../state/mutex";
import { canvasState } from "../state/workspace";

let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let saveChain = Promise.resolve();

/** Runs one editor storage operation in the shared save order under the editor mutex. */
export function runEditorStorageOperation<T>(operation: () => Promise<T>): Promise<T> {
	const queued = saveChain.then(async () => {
		const release = await acquireMutex();
		try {
			return await operation();
		} finally {
			release();
		}
	});
	saveChain = queued.then(
		() => undefined,
		() => undefined
	);
	return queued;
}

function clearPendingSave() {
	if (!saveTimeout) return;
	clearTimeout(saveTimeout);
	saveTimeout = null;
}

function currentProject(): StoredEditorProject {
	const project = get(projectState);
	const canvas = get(canvasState);

	return {
		id: project.id,
		name: project.name,
		canvas: {
			width: canvas.width,
			height: canvas.height,
			color: canvas.color,
			x: canvas.x,
			y: canvas.y
		},
		camera: { ...canvas.camera },
		elements: project.elements.map((element) => ({ ...element })),
		editorData: copyProjectEditorData({ elementNameGrid: project.elementNameGrid }),
		isElementNameImportOpen: project.isElementNameImportOpen
	};
}

function saveCurrentProject(): Promise<void> {
	return runEditorStorageOperation(async () => {
		const result = await storage.project.save(currentProject());
		if (!result.ok) console.warn("Failed to save project:", result.error);
	});
}

/** Persists a complete project and its assets in the shared save order. */
export function persistEditorProject(
	project: StoredEditorProject,
	assets: readonly StoredImageAsset[]
): Promise<boolean> {
	return runEditorStorageOperation(async () => {
		const result = await storage.project.replace(project, assets);
		if (!result.ok) console.warn("Failed to persist project:", result.error);
		return result.ok;
	});
}

/** Queues a debounced project save after editor session hydration completes. */
export function queueEditorSave(): void {
	if (!get(projectState).initialized) return;
	clearPendingSave();

	saveTimeout = setTimeout(() => {
		void saveCurrentProject();
	}, 500);
}

/** Persists a pending debounce, then waits for all queued project writes. */
export async function settleEditorSave(): Promise<void> {
	if (saveTimeout) {
		clearPendingSave();
		await saveCurrentProject();
		return;
	}
	await saveChain;
}

/** Cancels a pending debounce and persists the current project immediately. */
export async function flushEditorSave(): Promise<void> {
	if (get(projectState).initialized) {
		clearPendingSave();
		await saveCurrentProject();
		return;
	}
	await saveChain;
}
