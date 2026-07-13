import type { ImageElement, StoredImageAsset } from "@maply/model/types";
import { replaceImageAsset } from "editor/image/upload";
import { imageAssetState } from "editor/state/assets";
import { projectState, updateProjectState } from "editor/state/document";
import { get } from "svelte/store";
import { describe, expect, it } from "vitest";

const image: ImageElement = {
	id: "image",
	name: "Image",
	type: "image",
	x: 100,
	y: 100,
	width: 200,
	height: 100,
	assetId: null,
	cropX: 0,
	cropY: 0,
	cropScale: 100
};

const replacement: StoredImageAsset = {
	id: "replacement",
	projectId: "prod",
	name: "replacement.png",
	mimeType: "image/png",
	dataUrl: "data:image/png;base64,AA==",
	width: 400,
	height: 200
};

describe("replaceImageAsset", () => {
	it("does not publish replacement state when persistence fails", async () => {
		updateProjectState((state) => ({ ...state, elements: [image] }), "rescan");
		imageAssetState.set({});
		const before = structuredClone(get(projectState));
		const restore = failIndexedDbOpen();

		const result = await replaceImageAsset(image.id, replacement);

		restore();
		expect(result.ok).toBe(false);
		expect(get(projectState)).toEqual(before);
		expect(get(imageAssetState)).toEqual({});
	});
});

function failIndexedDbOpen(): () => void {
	const current = globalThis.indexedDB;
	Object.defineProperty(globalThis, "indexedDB", {
		configurable: true,
		value: {
			open: () => {
				throw new Error("Injected IndexedDB failure");
			}
		}
	});
	return () => Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: current });
}
