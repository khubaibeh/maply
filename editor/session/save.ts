import type { Project } from "@maply/model/types";
import { storage } from "@maply/storage";
import { projectState } from "editor/state/document";
import { canvasState } from "editor/state/workspace";
import { get } from "svelte/store";

let saveTimeout: ReturnType<typeof setTimeout> | null = null;

function clearPendingSave() {
	if (!saveTimeout) return;
	clearTimeout(saveTimeout);
	saveTimeout = null;
}

function currentProject(): Project {
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
		// Retained only for the legacy persisted-project schema; it is not editor state.
		importExportState: { importsOpen: true, elementsOpen: true }
	};
}

async function saveCurrentProject() {
	const result = await storage.project.save(currentProject());
	if (!result.ok) console.warn("Failed to save project:", result.error);
}

/** Queues a debounced project save after editor session hydration completes. */
export function queueEditorSave(): void {
	if (!get(projectState).initialized) return;
	clearPendingSave();

	saveTimeout = setTimeout(() => {
		void saveCurrentProject();
	}, 500);
}

/** Cancels a pending debounce and persists the current project immediately. */
export async function flushEditorSave(): Promise<void> {
	if (!get(projectState).initialized) return;
	clearPendingSave();
	await saveCurrentProject();
}
