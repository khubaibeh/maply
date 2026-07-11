import { project as ioProject } from "@maply/io";
import { storage } from "@maply/storage";
import { get } from "svelte/store";

import { loadEditorSession } from "../session/load";
import { projectState } from "../state/document";

/** Atomically replaces the active project with an IO-validated project-file payload. */
export async function importProject(
	projectFile: Parameters<typeof ioProject.file.assign>[0]
): Promise<{ ok: true } | { ok: false; error: unknown }> {
	const projectId = get(projectState).id;
	const assigned = await ioProject.file.assign(projectFile, projectId);

	if (!assigned.ok) {
		return { ok: false, error: assigned.error };
	}

	const replaced = await storage.project.replace(assigned.value.project, assigned.value.imageAssets);

	if (!replaced.ok) {
		return { ok: false, error: replaced.error };
	}

	await loadEditorSession(projectId);
	return { ok: true };
}
