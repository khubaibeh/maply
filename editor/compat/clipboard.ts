import type { Element, Point } from "@maply/model/types";
import { storage } from "@maply/storage";
import { get } from "svelte/store";

import { autofixElementName, createElementId } from "../elements/naming";
import { copy, getClipboard } from "../selection/clipboard";
import { imageAssetState } from "../state/assets";
import { projectState } from "../state/document";
import { canvasState } from "../state/workspace";
import { clampElementToCanvas, getElementBounds } from "./geometry";

const pasteOffset = 20;

function assetId(): string {
	return typeof crypto !== "undefined" && crypto.randomUUID
		? crypto.randomUUID()
		: Math.random().toString(36).slice(2);
}

export { copy, getClipboard };

export async function paste(point?: Point): Promise<void> {
	const copied = getClipboard();
	if (copied.length === 0) return;
	const canvas = get(canvasState);
	const assets = get(imageAssetState);
	const project = get(projectState);
	const clonedAssets: Array<(typeof assets)[string]> = [];
	const pasted: Element[] = [];

	for (const element of copied) {
		const next = {
			...element,
			id: createElementId(),
			name: autofixElementName(`${element.name}-copy`, [...project.elements, ...pasted])
		};
		if (next.type === "image" && next.assetId) {
			const source = assets[next.assetId];
			if (source) {
				const id = assetId();
				clonedAssets.push({ ...source, id, projectId: project.id });
				next.assetId = id;
			} else next.assetId = null;
		}
		if (next.type === "circle") {
			next.cx += pasteOffset;
			next.cy += pasteOffset;
		} else {
			next.x += pasteOffset;
			next.y += pasteOffset;
		}
		pasted.push(clampElementToCanvas(next as Element, canvas));
	}

	const positioned = point
		? (() => {
				const bounds = pasted.map(getElementBounds);
				const dx = point.x - Math.min(...bounds.map((entry) => entry.x));
				const dy = point.y - Math.min(...bounds.map((entry) => entry.y));
				return pasted.map((element) =>
					clampElementToCanvas(
						element.type === "circle"
							? { ...element, cx: element.cx + dx, cy: element.cy + dy }
							: ({ ...element, x: element.x + dx, y: element.y + dy } as Element),
						canvas
					)
				);
			})()
		: pasted;

	for (const asset of clonedAssets) {
		const result = await storage.imageAsset.save(asset);
		if (!result.ok) {
			console.warn("Failed to persist cloned image asset:", result.error);
			return;
		}
	}
	imageAssetState.update((current) => ({
		...current,
		...Object.fromEntries(clonedAssets.map((asset) => [asset.id, asset]))
	}));
	projectState.update((state) => ({
		...state,
		elements: [...state.elements, ...positioned],
		selectedElementIds: positioned.map((element) => element.id),
		selectedElementId: positioned.at(-1)?.id ?? null
	}));
}
