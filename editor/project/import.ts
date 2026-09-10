import { project as ioProject } from "@maply/io";
import { copyProjectEditorData } from "@maply/model";
import { storage } from "@maply/storage";
import { get } from "svelte/store";

import { history } from "../history";
import { loadEditorSession } from "../session/load";
import { runEditorStorageOperation } from "../session/save";
import { projectState, updateProjectState } from "../state/document";
import { applyInternalEditorMutation, withEditorMutationBlock } from "../state/editing";

/** Atomically replaces the active project with an IO-validated project-file payload. */
export async function importProject(
	projectFile: Parameters<typeof ioProject.file.assign>[0]
): Promise<{ ok: true } | { ok: false; error: unknown }> {
	return withEditorMutationBlock(() => importProjectBlocked(projectFile));
}

async function importProjectBlocked(
	projectFile: Parameters<typeof ioProject.file.assign>[0]
): Promise<{ ok: true } | { ok: false; error: unknown }> {
	const projectId = get(projectState).id;
	const assigned = await ioProject.file.assign(projectFile, projectId);

	if (!assigned.ok) {
		return { ok: false, error: assigned.error };
	}

	await history.settle();
	applyInternalEditorMutation(() => {
		updateProjectState((state) => ({ ...state, initialized: false }), "preserve");
	});
	const replaced = await runEditorStorageOperation(() =>
		storage.project.replace(
			{
				...assigned.value.project,
				editorData: copyProjectEditorData(assigned.value.editorData),
				isElementNameImportOpen: true
			},
			assigned.value.imageAssets
		)
	);

	if (!replaced.ok) {
		applyInternalEditorMutation(() => {
			updateProjectState((state) => ({ ...state, initialized: true }), "preserve");
		});
		return { ok: false, error: replaced.error };
	}

	await loadEditorSession(projectId);
	return { ok: true };
}
