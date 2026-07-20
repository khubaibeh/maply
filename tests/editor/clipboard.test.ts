import type { ImageElement, RectElement, StoredImageAsset } from "@maply/model/types";
import { copy, paste } from "editor/selection/clipboard";
import { imageAssetState } from "editor/state/assets";
import { projectState, updateProjectState } from "editor/state/document";
import { canvasState } from "editor/state/workspace";
import { get } from "svelte/store";
import { describe, expect, it } from "vitest";

function rect(id: string, name: string): RectElement {
	return {
		id,
		name,
		type: "rect",
		x: 10,
		y: 10,
		width: 20,
		height: 20,
		fill: "#000",
		stroke: "#000",
		strokeWidth: 0
	};
}

const asset: StoredImageAsset = {
	id: "source",
	projectId: "prod",
	name: "source.png",
	mimeType: "image/png",
	dataUrl: "data:image/png;base64,AA==",
	width: 400,
	height: 200
};

describe("paste", () => {
	it("derives copied names from source names", async () => {
		const source = rect("rect", "company-logo");
		updateProjectState((state) => ({ ...state, elements: [source] }), "rescan");
		copy([source]);

		await paste();
		expect(get(projectState).elements.at(-1)?.name).toBe("company-logo-copy");
	});

	it("advances generated default names", async () => {
		const source = rect("rect", "rectangle1");
		updateProjectState((state) => ({ ...state, elements: [source] }), "rescan");
		copy([source]);

		await paste();
		expect(get(projectState).elements.at(-1)?.name).toBe("rectangle2");
	});

	it("continues copy numbering instead of nesting copy suffixes", async () => {
		const source = rect("rect", "vertical-copy-2");
		updateProjectState(
			(state) => ({ ...state, elements: [rect("a", "vertical-copy"), rect("b", "vertical-copy-2"), source] }),
			"rescan"
		);
		copy([source]);

		await paste();
		expect(get(projectState).elements.at(-1)?.name).toBe("vertical-copy-3");
	});

	it("does not publish pasted images when asset persistence fails", async () => {
		const image: ImageElement = {
			id: "image",
			name: "Image",
			type: "image",
			x: 100,
			y: 100,
			width: 200,
			height: 100,
			assetId: asset.id,
			cropX: 0,
			cropY: 0,
			cropScale: 100
		};
		canvasState.set({ width: 800, height: 600, color: "#fff", x: 0, y: 0, camera: { x: 0, y: 0, zoom: 1 } });
		updateProjectState((state) => ({ ...state, elements: [image] }), "rescan");
		imageAssetState.set({ [asset.id]: asset });
		copy([image]);
		const restore = failIndexedDbOpen();

		await paste();

		restore();
		expect(get(projectState).elements).toEqual([image]);
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
