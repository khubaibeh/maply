import { saveProject } from "../core/db";
import type { Project } from "../domain/project";

let saveTimeout: ReturnType<typeof setTimeout> | null = null;

export function queueProjectSave(project: Project, canSave: boolean) {
	if (!canSave) return;
	if (saveTimeout) clearTimeout(saveTimeout);

	saveTimeout = setTimeout(() => {
		saveProject(project).catch((error) => {
			console.warn("Failed to save project:", error);
		});
	}, 500);
}

export async function saveProjectNow(project: Project, canSave: boolean) {
	if (!canSave) return;
	if (saveTimeout) clearTimeout(saveTimeout);

	try {
		await saveProject(project);
	} catch (error) {
		console.warn("Failed to save project:", error);
	}
}
