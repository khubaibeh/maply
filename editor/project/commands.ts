import { storage } from "@maply/storage";

import { loadEditorSession } from "../session/load";
import { projectState } from "../state/document";

/** Renames the active project in live editor state. */
export function rename(name: string): void {
	projectState.update((state) => ({ ...state, name }));
}

/** Resets the active persisted project to blank or sample content, then rehydrates editor state. */
export async function create(options: { elements?: "sample" | "blank" } = {}) {
	const result = await storage.project.reset(options);

	if (!result.ok) {
		console.warn("Failed to reset project:", result.error);
		return result;
	}

	await loadEditorSession(result.value.id);

	return { ok: true as const, value: undefined };
}
