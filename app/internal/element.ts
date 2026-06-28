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
	return bridgePaste();
}

export function deleteElement(id: string) {
	return bridgeDelete(id);
}

export function replaceElementImage(id: string, file: File) {
	return bridgeReplaceImage(id, file);
}
