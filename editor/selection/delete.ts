import { Effect } from "effect";
import { get } from "svelte/store";

import { deleteImageAssetEffect, forkStorageEffect, withEditorWriteGate } from "../session/coordinator";
import { imageAssetState } from "../state/assets";
import { projectState, updateProjectState } from "../state/document";
import { isEditorMutationBlocked } from "../state/editing";

/** Removes elements and their now-unreferenced persisted image assets. */
export function deleteElements(ids: string | readonly string[]): boolean {
	if (isEditorMutationBlocked()) return false;
	const idSet = new Set(typeof ids === "string" ? [ids] : ids);
	const removed = get(projectState).elements.filter((element) => idSet.has(element.id));

	updateProjectState(
		(state) => {
			const selectedElementIds = state.selectedElementIds.filter((id) => !idSet.has(id));

			return {
				...state,
				elements: state.elements.filter((element) => !idSet.has(element.id)),
				selectedElementIds,
				selectedElementId: selectedElementIds.at(-1) ?? null,
				cropEditingElementId:
					state.cropEditingElementId && idSet.has(state.cropEditingElementId)
						? null
						: state.cropEditingElementId
			};
		},
		{ deleted: [...idSet] }
	);

	const remaining = get(projectState).elements;
	const usedAssetIds = new Set(
		remaining.flatMap((element) => (element.type === "image" && element.assetId ? [element.assetId] : []))
	);

	for (const element of removed) {
		if (element.type !== "image" || !element.assetId) continue;

		const assetId = element.assetId;
		if (usedAssetIds.has(assetId)) continue;

		imageAssetState.update((assets) => {
			const next = { ...assets };
			delete next[assetId];
			return next;
		});

		// `runFork` starts this effect immediately, so it queues on the shared write gate
		// before a subsequently invoked undo can settle and replace its snapshot. That
		// replacement recreates this asset when the deleted image is restored.
		void forkStorageEffect(
			withEditorWriteGate(
				Effect.match(deleteImageAssetEffect(assetId), {
					onFailure: (error) => {
						console.warn("Failed to delete image asset:", error.cause);
					},
					onSuccess: () => {}
				})
			)
		);
	}

	return true;
}
