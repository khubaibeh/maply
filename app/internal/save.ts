import { Effect } from "effect";

import { appProjectState } from "../store/project";

function bridgeSaveQueue() {
	return Effect.sync(() => appProjectState.queueSave());
}

function bridgeSaveFlush() {
	return Effect.promise(() => appProjectState.saveNow());
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
