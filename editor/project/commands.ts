import { storage } from "@maply/storage";

import { history } from "../history";
import { loadEditorSession } from "../session/load";
import { runEditorStorageOperation } from "../session/save";
import { updateProjectState } from "../state/document";
import { applyInternalEditorMutation, withEditorMutationBlock } from "../state/editing";

/** Renames the active project in live editor state. */
export function rename(name: string): void {
	updateProjectState((state) => ({ ...state, name }), "preserve");
}

/** Resets the active persisted project to blank or sample content, then rehydrates editor state. */
export async function create(options: { elements?: "sample" | "blank" } = {}) {
	return withEditorMutationBlock(() => createBlocked(options));
}

async function createBlocked(options: { elements?: "sample" | "blank" }) {
	await history.settle();
	applyInternalEditorMutation(() => {
		updateProjectState((state) => ({ ...state, initialized: false }), "preserve");
	});
	const result = await runEditorStorageOperation(() => storage.project.reset(options));

	if (!result.ok) {
		console.warn("Failed to reset project:", result.error);
		applyInternalEditorMutation(() => {
			updateProjectState((state) => ({ ...state, initialized: true }), "preserve");
		});
		return result;
	}

	await loadEditorSession(result.value.id);

	return { ok: true as const, value: undefined };
}
