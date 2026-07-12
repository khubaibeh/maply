import type { StoredImageAsset } from "@maply/model/types";
import { storage } from "@maply/storage";
import { get } from "svelte/store";

import { createElementId } from "../elements/naming";
import { imageAssetState } from "../state/assets";
import { projectState } from "../state/document";
import { acquireMutex } from "../state/mutex";
import { canvasState } from "../state/workspace";

/** Atomically attaches a prepared asset and replaces the active project's referenced asset set. */
export async function replaceImageAsset(id: string, asset: StoredImageAsset): Promise<void> {
	const release = await acquireMutex();

	try {
		const project = get(projectState);
		const current = project.elements.find((element) => element.id === id);

		if (!current || current.type !== "image") return;

		const nextAsset = { ...asset, id: createElementId(), projectId: project.id };

		const elements = project.elements.map((element) => {
			if (element.id !== id || element.type !== "image") return element;
			return { ...element, assetId: nextAsset.id, href: undefined, cropX: 0, cropY: 0, cropScale: 100 };
		});

		const currentAssets = get(imageAssetState);
		const mergedAssets = { ...currentAssets, [nextAsset.id]: nextAsset };

		const assetIdSet = new Set(
			elements.flatMap((element) => (element.type === "image" && element.assetId ? [element.assetId] : []))
		);
		const referencedAssets = [...assetIdSet].map((assetId) => mergedAssets[assetId]);

		if (referencedAssets.some((entry) => !entry)) {
			console.warn("Cannot replace image because a referenced asset is unavailable.");
			return;
		}

		const canvas = get(canvasState);
		const replaced = await storage.project.replace(
			{
				id: project.id,
				name: project.name,
				canvas: { width: canvas.width, height: canvas.height, color: canvas.color, x: canvas.x, y: canvas.y },
				camera: { ...canvas.camera },
				elements,
				importExportState: { importsOpen: true, elementsOpen: true }
			},
			referencedAssets.filter((entry): entry is StoredImageAsset => entry !== undefined)
		);

		if (!replaced.ok) {
			console.warn("Failed to replace image asset:", replaced.error);
			return;
		}

		projectState.update((state) => ({ ...state, elements }));

		imageAssetState.update((assets) => {
			const next = { ...assets, [nextAsset.id]: nextAsset };
			for (const key of Object.keys(next)) {
				if (!assetIdSet.has(key) && next[key]?.projectId === project.id) {
					delete next[key];
				}
			}
			return next;
		});
	} finally {
		release();
	}
}
