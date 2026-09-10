import { Effect } from "effect";

import { history } from "../history";
import { deleteImageAssetEffect, forkEditorWriteEffect, withEditorWriteGate } from "../session/coordinator";
import { imageAssetState } from "../state/assets";
import { documentIndex, updateIndexedProject } from "../state/document";
import { isEditorMutationBlocked } from "../state/editing";
import { getInteractionState, updateInteractionState } from "../state/interaction";

/** Removes elements and their now-unreferenced persisted image assets.
 *
 * Returns `false` only when a session operation blocked the mutation; `true` means the deletion was admitted.
 */
export function deleteElements(ids: string | readonly string[]): boolean {
	if (isEditorMutationBlocked()) return false;
	const idSet = new Set(typeof ids === "string" ? [ids] : ids);
	const removed = [...idSet].flatMap((id) => {
		const element = documentIndex.get(id);
		return element ? [element] : [];
	});
	const interaction = getInteractionState();
	const selectedElementIds = interaction.selectedElementIds.filter((id) => !idSet.has(id));

	updateIndexedProject((document) => document.delete([...idSet]));
	updateInteractionState((state) => ({
		...state,
		selectedElementIds,
		selectedElementId: selectedElementIds.at(-1) ?? null,
		cropEditingElementId:
			state.cropEditingElementId && idSet.has(state.cropEditingElementId) ? null : state.cropEditingElementId
	}));

	const remaining = documentIndex.snapshot();
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

		if (history.deferAssetDeletion(assetId)) continue;
		void forkEditorWriteEffect(
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
