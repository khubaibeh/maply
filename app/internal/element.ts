import { Effect } from "effect";

import type { Point } from "../domain/geometry";
import { appProjectState } from "../store/project";

function bridgePaste(point?: Point) {
	return Effect.promise(() => appProjectState.pasteClipboardElement(point));
}

function bridgeDelete(id: string) {
	return Effect.sync(() => appProjectState.deleteElement(id));
}

function bridgeReplaceImage(id: string, file: File) {
	return Effect.promise(() => appProjectState.setImageAssetFromFile(id, file));
}

export function pasteElement(point?: Point) {
	return bridgePaste(point);
}

export function deleteElement(id: string) {
	return bridgeDelete(id);
}

export function replaceElementImage(id: string, file: File) {
	return bridgeReplaceImage(id, file);
}
