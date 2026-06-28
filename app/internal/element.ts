import { Effect } from "effect";

import { appProjectState } from "../store/project";

function bridgePaste() {
	return Effect.promise(() => appProjectState.pasteClipboardElement());
}

function bridgeDelete(id: string) {
	return Effect.sync(() => appProjectState.deleteElement(id));
}

function bridgeReplaceImage(id: string, file: File) {
	return Effect.promise(() => appProjectState.setImageAssetFromFile(id, file));
}

export function pasteElement() {
	/*
	 * Temporary migration bridge: element workflows still depend on src/lib-owned
	 * state. Keep that dependency isolated here so the later switch to app-owned
	 * element logic only replaces this implementation, not the public API.
	 */
	return bridgePaste();
}

export function deleteElement(id: string) {
	/*
	 * Temporary migration bridge: element workflows still depend on src/lib-owned
	 * state. Keep that dependency isolated here so the later switch to app-owned
	 * element logic only replaces this implementation, not the public API.
	 */
	return bridgeDelete(id);
}

export function replaceElementImage(id: string, file: File) {
	/*
	 * Temporary migration bridge: element workflows still depend on src/lib-owned
	 * state. Keep that dependency isolated here so the later switch to app-owned
	 * element logic only replaces this implementation, not the public API.
	 */
	return bridgeReplaceImage(id, file);
}
