import { saveProject } from "$lib/app/core/db";

import type { Project } from "../domain/project";

let saveTimeout: ReturnType<typeof setTimeout> | null = null;

export function queueProjectSave(project: Project, canSave: boolean) {
	// Saves before hydration can overwrite persisted data with startup defaults.
	if (!canSave) return;
	if (saveTimeout) clearTimeout(saveTimeout);

	saveTimeout = setTimeout(() => {
		saveProject(project).catch((error) => {
			console.warn("Failed to save project:", error);
		});
	}, 500);
}

export async function saveProjectNow(project: Project, canSave: boolean) {
	// Flushes replace the pending debounce so unload handlers do not race a later save.
	if (!canSave) return;
	if (saveTimeout) clearTimeout(saveTimeout);

	try {
		await saveProject(project);
	} catch (error) {
		console.warn("Failed to save project:", error);
	}
}
