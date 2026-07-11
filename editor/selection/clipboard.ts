import type { Element, Point } from "@maply/model/types";
import { storage } from "@maply/storage";
import { get } from "svelte/store";

import { clampElementToCanvas, getElementBounds } from "../elements/geometry";
import { createElementId, nextElementName } from "../elements/naming";
import { imageAssetState } from "../state/assets";
import { clipboardState, projectState } from "../state/document";
import { canvasState } from "../state/workspace";

const pasteOffset = 20;

function cloneAssetId(): string {
	if (typeof crypto !== "undefined" && crypto.randomUUID) {
		return crypto.randomUUID();
	}

	return Math.random().toString(36).slice(2);
}

/** Copies immutable element snapshots into the editor clipboard. */
export function copy(elements: readonly Element[]): void {
	clipboardState.set(structuredClone([...elements]));
}

/** Returns immutable clipboard snapshots. */
export function getClipboard(): Element[] {
	return structuredClone(get(clipboardState));
}

/** Duplicates clipboard elements with new IDs/names, clones image assets, and clamps to canvas. */
export function paste(point?: Point): void {
	const copied = getClipboard();
	if (copied.length === 0) return;

	const canvas = get(canvasState);
	const assets = get(imageAssetState);
	const projectId = get(projectState).id;
	const clonedAssets: { elementId: string; asset: (typeof assets)[string] }[] = [];

	projectState.update((state) => {
		const pasted = copied.map((element, index) => {
			const elements = [...state.elements, ...copied.slice(0, index)];
			const next = {
				...element,
				id: createElementId(),
				name: nextElementName(element.type, elements)
			};

			if (next.type === "image" && next.assetId) {
				const sourceAsset = assets[next.assetId];
				if (sourceAsset) {
					const clonedId = cloneAssetId();
					clonedAssets.push({
						elementId: next.id,
						asset: { ...sourceAsset, id: clonedId, projectId }
					});
					next.assetId = clonedId;
				} else {
					next.assetId = null;
				}
			}

			if (next.type === "circle") {
				next.cx = next.cx + pasteOffset;
				next.cy = next.cy + pasteOffset;
			} else {
				next.x = next.x + pasteOffset;
				next.y = next.y + pasteOffset;
			}

			return clampElementToCanvas(next as Element, canvas);
		});

		const positioned =
			point && pasted.length > 0
				? (() => {
						const bounds = pasted.map(getElementBounds);
						const minX = Math.min(...bounds.map((b) => b.x));
						const minY = Math.min(...bounds.map((b) => b.y));
						const dx = point.x - minX;
						const dy = point.y - minY;

						return pasted.map((element) => {
							if (element.type === "circle") {
								return clampElementToCanvas(
									{ ...element, cx: element.cx + dx, cy: element.cy + dy },
									canvas
								);
							}
							return clampElementToCanvas(
								{ ...element, x: element.x + dx, y: element.y + dy } as Element,
								canvas
							);
						});
					})()
				: pasted;

		return {
			...state,
			elements: [...state.elements, ...positioned],
			selectedElementIds: positioned.map((element) => element.id),
			selectedElementId: positioned.at(-1)?.id ?? null
		};
	});

	for (const { asset } of clonedAssets) {
		imageAssetState.update((current) => ({ ...current, [asset.id]: asset }));
		storage.imageAsset.save(asset).then((result) => {
			if (!result.ok) console.warn("Failed to persist cloned image asset:", result.error);
		});
	}
}
