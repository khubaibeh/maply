import { projectState } from "$lib/app/state/project.svelte";
import { Effect } from "effect";

function bridgeSaveQueue() {
	return Effect.sync(() => projectState.queueSave());
}

function bridgeSaveFlush() {
	return Effect.promise(() => projectState.saveNow());
}

export function queueProjectSave() {
	/*
	 * Temporary migration bridge: save still depends on src/lib-owned state.
	 * Keep that dependency isolated in this file so the later switch to app-owned
	 * state only replaces this implementation, not the public API or call sites.
	 */
	return bridgeSaveQueue();
}

export function flushProjectSave() {
	/*
	 * Temporary migration bridge: save still depends on src/lib-owned state.
	 * Keep that dependency isolated in this file so the later switch to app-owned
	 * state only replaces this implementation, not the public API or call sites.
	 */
	return bridgeSaveFlush();
}
