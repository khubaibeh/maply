import { Effect } from "effect";

import { appProjectState } from "../store/project";

function bridgeSaveQueue() {
	return Effect.sync(() => appProjectState.queueSave());
}

function bridgeSaveFlush() {
	return Effect.promise(() => appProjectState.saveNow());
}

export function queueProjectSave() {
	// Keep the Effect-facing save API localized here while the live store owns save triggering.
	return bridgeSaveQueue();
}

export function flushProjectSave() {
	// Keep the Effect-facing flush API localized here while the live store owns save triggering.
	return bridgeSaveFlush();
}
