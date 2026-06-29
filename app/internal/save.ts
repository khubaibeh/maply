import { Effect } from "effect";

import { appProjectState } from "../store/project";
import { saveProject } from "./db";

let saveTimeout: ReturnType<typeof setTimeout> | null = null;

function clearPendingSave() {
	if (!saveTimeout) return;
	clearTimeout(saveTimeout);
	saveTimeout = null;
}

function canSave() {
	return appProjectState.getSnapshot().initialized;
}

function queueCurrentProjectSave() {
	// Saves before hydration can overwrite persisted data with startup defaults.
	if (!canSave()) return;
	clearPendingSave();

	saveTimeout = setTimeout(() => {
		saveProject(appProjectState.toProject()).catch((error) => {
			console.warn("Failed to save project:", error);
		});
	}, 500);
}

async function flushCurrentProjectSave() {
	// Flushes replace the pending debounce so unload handlers do not race a later save.
	if (!canSave()) return;
	clearPendingSave();

	try {
		await saveProject(appProjectState.toProject());
	} catch (error) {
		console.warn("Failed to save project:", error);
	}
}

export function queueProjectSave() {
	return Effect.sync(() => queueCurrentProjectSave());
}

export function flushProjectSave() {
	return Effect.promise(() => flushCurrentProjectSave());
}
