import { fetchImageAssets } from "$lib/app/core/db";
import { get, writable } from "svelte/store";

import type { Element } from "../domain/elements";
import type { StoredImageAsset } from "../domain/image-assets";

const store = writable<Record<string, StoredImageAsset>>({});

function getImageAssetIds(elements: Element[]) {
	return elements.flatMap((element) => (element.type === "image" && element.assetId ? [element.assetId] : []));
}

export const appImageAssetState = {
	subscribe: store.subscribe,

	getSnapshot() {
		return get(store);
	},

	getAsset(id: string | null | undefined) {
		if (!id) return null;
		return get(store)[id] ?? null;
	},

	async loadForElements(elements: Element[]) {
		const ids = getImageAssetIds(elements);
		if (ids.length === 0) {
			store.set({});
			return;
		}

		const assets = await fetchImageAssets(ids);
		store.set(Object.fromEntries(assets.map((asset) => [asset.id, asset])));
	},

	setAsset(asset: StoredImageAsset) {
		store.update((assets) => ({ ...assets, [asset.id]: asset }));
	},

	setAll(nextAssets: StoredImageAsset[]) {
		store.set(Object.fromEntries(nextAssets.map((asset) => [asset.id, asset])));
	},

	removeAsset(id: string | null | undefined) {
		if (!id) return;
		store.update((assets) => {
			const next = { ...assets };
			delete next[id];
			return next;
		});
	},

	clear() {
		store.set({});
	}
};
