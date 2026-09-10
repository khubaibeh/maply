import type { ImageElement, RectElement, StoredImageAsset } from "@maply/model/types";
import { storage } from "@maply/storage";
import { updateElement } from "editor/elements/mutate";
import { history } from "editor/history";
import { deleteElements } from "editor/selection/delete";
import { runStorageEffect, settleEditorWrites } from "editor/session/coordinator";
import { imageAssetState } from "editor/state/assets";
import { projectState, updateProjectState } from "editor/state/document";
import { canvasState } from "editor/state/workspace";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import { get } from "svelte/store";
import { describe, expect, it } from "vitest";

Object.assign(globalThis, { IDBKeyRange, indexedDB });

function rect(): RectElement {
	return {
		id: "rect",
		name: "rect",
		type: "rect",
		locked: false,
		visible: true,
		bindable: true,
		x: 10,
		y: 10,
		width: 20,
		height: 20,
		fill: "#000",
		stroke: "#000",
		strokeWidth: 1
	};
}

function image(): ImageElement {
	return {
		id: "image",
		name: "image",
		type: "image",
		locked: false,
		visible: true,
		bindable: false,
		x: 10,
		y: 10,
		width: 20,
		height: 20,
		assetId: "asset",
		cropX: 0,
		cropY: 0,
		cropScale: 100
	};
}

function setup() {
	history.reset();
	canvasState.set({ width: 300, height: 300, color: "#fff", x: 0, y: 0, camera: { x: 0, y: 0, zoom: 1 } });
	updateProjectState(
		(state) => ({
			...state,
			initialized: false,
			elements: [rect()],
			selectedElementId: "rect",
			selectedElementIds: ["rect"]
		}),
		"rescan"
	);
	history.reset();
}

function rectX(): number | undefined {
	const element = get(projectState).elements.find((candidate): candidate is RectElement => candidate.type === "rect");
	return element?.x;
}

describe("editor history", () => {
	it("records document changes, ignores camera and selection changes, and supports redo", async () => {
		setup();
		updateElement("rect", { x: 40 });
		updateProjectState((state) => ({ ...state, selectedElementIds: [] }), "preserve");
		canvasState.update((state) => ({ ...state, camera: { x: 20, y: 10, zoom: 2 } }));

		const undo = history.undo();
		await undo;
		expect(rectX()).toBe(10);
		expect(get(projectState).selectedElementIds).toEqual([]);
		expect(get(canvasState).camera.zoom).toBe(2);

		await history.redo();
		expect(rectX()).toBe(40);
	});

	it("groups a transaction and clears redo after a new edit", async () => {
		setup();
		const transaction = history.begin();
		updateElement("rect", { x: 20 });
		updateElement("rect", { x: 30 });
		history.commit(transaction);

		await history.undo();
		expect(rectX()).toBe(10);
		expect(get(history.canRedo)).toBe(true);

		updateElement("rect", { x: 15 });
		expect(get(history.canRedo)).toBe(false);
	});

	it("serializes rapid undo and redo requests", async () => {
		setup();
		updateElement("rect", { x: 20 });
		updateElement("rect", { x: 30 });

		await Promise.all([history.undo(), history.undo()]);
		expect(rectX()).toBe(10);

		await Promise.all([history.redo(), history.redo()]);
		expect(rectX()).toBe(30);
	});

	it("does not overwrite an edit made after undo starts", async () => {
		setup();
		updateElement("rect", { x: 20 });

		const undo = history.undo();
		updateElement("rect", { x: 30 });
		await undo;

		expect(rectX()).toBe(30);
		expect(get(history.canUndo)).toBe(true);
	});

	it("commits an open transaction before handing ownership to another action", async () => {
		setup();
		const first = history.begin();
		updateElement("rect", { x: 20 });

		const second = history.begin();
		expect(rectX()).toBe(20);
		updateElement("rect", { x: 30 });
		history.commit(first);
		history.commit(second);

		await history.undo();
		expect(rectX()).toBe(20);
		await history.undo();
		expect(rectX()).toBe(10);
	});

	it("does not record a cancelled or no-op transaction", () => {
		setup();
		const transaction = history.begin();
		updateElement("rect", { x: 20 });
		history.cancel(transaction);
		expect(rectX()).toBe(10);
		expect(get(history.canUndo)).toBe(false);

		updateElement("rect", { x: 10 });
		expect(get(history.canUndo)).toBe(false);
	});

	it("restores referenced image assets with their elements", async () => {
		setup();
		const asset: StoredImageAsset = {
			id: "asset",
			projectId: "prod",
			name: "image.png",
			mimeType: "image/png",
			dataUrl: "data:image/png;base64,AA==",
			width: 1,
			height: 1
		};
		imageAssetState.set({ asset });
		updateProjectState((state) => ({ ...state, elements: [image()] }), "rescan");
		history.reset();
		updateProjectState((state) => ({ ...state, elements: [] }), "rescan");

		await history.undo();
		expect(get(projectState).elements[0]?.id).toBe("image");
		expect(get(imageAssetState).asset).toEqual(asset);
	});

	it("keeps deleted image assets available for persisted undo", async () => {
		setup();
		const asset: StoredImageAsset = {
			id: "delete-asset",
			projectId: "prod",
			name: "image.png",
			mimeType: "image/png",
			dataUrl: "data:image/png;base64,AA==",
			width: 1,
			height: 1
		};
		const saved = await storage.imageAsset.save(asset);
		expect(saved.ok).toBe(true);
		imageAssetState.set({ [asset.id]: asset });
		updateProjectState((state) => ({ ...state, elements: [{ ...image(), assetId: asset.id }] }), "rescan");
		history.reset();

		expect(deleteElements("image")).toBe(true);
		await runStorageEffect(settleEditorWrites);
		const deleted = await storage.imageAsset.fetch([asset.id]);
		expect(deleted.ok).toBe(true);
		if (deleted.ok) expect(deleted.value).toEqual([]);

		await history.undo();

		const restored = await storage.imageAsset.fetch([asset.id]);
		expect(restored.ok).toBe(true);
		if (restored.ok) expect(restored.value).toEqual([asset]);
	});
});
