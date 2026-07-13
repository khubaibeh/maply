import type { Element, Point } from "@maply/model/types";
import { storage } from "@maply/storage";
import { get } from "svelte/store";

import { clampElementToCanvas, getElementBounds } from "../elements/geometry";
import { autofixElementName, createElementId, defaultElementName, nextElementName } from "../elements/naming";
import { imageAssetState } from "../state/assets";
import { clipboardState, projectState, updateProjectState } from "../state/document";
import { canvasState } from "../state/workspace";

function pastedName(element: Element, elements: readonly Element[]): string {
	const defaultName = defaultElementName(element.type);

	return new RegExp(`^${defaultName}\\d+$`).test(element.name)
		? nextElementName(element.type, elements)
		: autofixElementName(`${element.name}-copy`, elements);
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
			name: pastedName(element, [...project.elements, ...pasted])
		};

		if (next.type === "image" && next.assetId) {
			const source = assets[next.assetId];
			if (source) {
				const id = createElementId();
				clonedAssets.push({ ...source, id, projectId: project.id });
				next.assetId = id;
			} else next.assetId = null;
		}

		pasted.push(clampElementToCanvas(next as Element, canvas));
	}

	let positioned = pasted;

	if (point) {
		positioned = (() => {
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
		})();
	}

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

	updateProjectState(
		(state) => ({
			...state,
			elements: [...state.elements, ...positioned],
			selectedElementIds: positioned.map((element) => element.id),
			selectedElementId: positioned.at(-1)?.id ?? null
		}),
		{ added: positioned }
	);
}
