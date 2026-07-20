import { storage } from "@maply/storage";
import { get } from "svelte/store";

import { imageAssetState } from "../state/assets";
import { projectState, updateProjectState } from "../state/document";

/** Removes elements immediately and detaches parallel image asset cleanup. */
export function deleteElements(ids: string | readonly string[]): void {
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

		storage.imageAsset.delete(assetId).then((result) => {
			if (!result.ok) console.warn("Failed to delete image asset:", result.error);
		});
	}
}
