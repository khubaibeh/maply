import type { StoredImageAsset } from "@maply/model/types";
import { storage } from "@maply/storage";
import { get } from "svelte/store";

import { createElementId } from "../elements/naming";
import { imageAssetState } from "../state/assets";
import { projectState } from "../state/document";

/** Persists a prepared image asset before attaching it to an image element. */
export async function replaceImageAsset(id: string, asset: StoredImageAsset): Promise<void> {
	const project = get(projectState);
	const current = project.elements.find((element) => element.id === id);

	if (!current || current.type !== "image") return;

	const nextAsset = { ...asset, id: createElementId(), projectId: project.id };
	const saved = await storage.imageAsset.save(nextAsset);

	if (!saved.ok) {
		console.warn("Failed to save image asset:", saved.error);
		return;
	}

	imageAssetState.update((assets) => ({ ...assets, [nextAsset.id]: nextAsset }));

	let previousAssetId: string | null = null;
	projectState.update((state) => ({
		...state,
		elements: state.elements.map((element) => {
			if (element.id !== id || element.type !== "image") return element;

			previousAssetId = element.assetId;

			return { ...element, assetId: nextAsset.id, href: undefined, cropX: 0, cropY: 0, cropScale: 100 };
		})
	}));

	if (!previousAssetId || previousAssetId === nextAsset.id) return;

	const stillUsed = get(projectState).elements.some(
		(element) => element.type === "image" && element.assetId === previousAssetId
	);

	if (stillUsed) return;

	imageAssetState.update((assets) => {
		const next = { ...assets };
		delete next[previousAssetId!];
		return next;
	});

	storage.imageAsset.delete(previousAssetId).then((result) => {
		if (!result.ok) console.warn("Failed to delete replaced image asset:", result.error);
	});
}
