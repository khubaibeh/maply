import { importExportState } from "editor/compat/project-state";
import { loadEditorSession } from "editor/compat/session";
import { projectState } from "editor/state/document";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import { get } from "svelte/store";
import { beforeAll, describe, expect, it } from "vitest";

Object.assign(globalThis, { IDBKeyRange, indexedDB });

beforeAll(async () => {
	await putLegacyProject();
});

describe("legacy project hydration", () => {
	it("normalizes representative persisted elements and preserves panel state", async () => {
		await loadEditorSession("prod");

		const state = get(projectState);
		expect(state.elements[0]).toMatchObject({ name: "path", x: 0, y: 0, closed: true, strokeWidth: 0 });
		expect(state.elements[1]).toMatchObject({ name: "text", width: 58, height: 29 });
		expect(state.elements[2]).toMatchObject({
			name: "image",
			assetId: null,
			cropX: 100,
			cropY: 0,
			cropScale: 100
		});
		expect(get(importExportState)).toEqual({ importsOpen: false, elementsOpen: false });
	});
});

async function putLegacyProject(): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		const request = indexedDB.deleteDatabase("maply");
		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
	});

	await new Promise<void>((resolve, reject) => {
		const request = indexedDB.open("maply", 4);
		request.onupgradeneeded = () => {
			const projects = request.result.createObjectStore("projects", { keyPath: "id" });
			const assets = request.result.createObjectStore("image-assets", { keyPath: "id" });
			assets.createIndex("projectId", "projectId", { unique: false });
			projects.put({
				id: "prod",
				name: "Legacy",
				canvas: { width: 800, height: 800, color: "#fff", x: 0, y: 0 },
				camera: { x: 0, y: 0, zoom: 1 },
				importExportState: { importsOpen: false, elementsOpen: false },
				elements: [
					{
						id: "path",
						type: "path",
						d: "M0,0 L50,0 L50,50 Z",
						fill: "#000",
						stroke: "#000",
						strokeWidth: 3
					},
					{ id: "text", type: "text", x: 10, y: 40, text: "Test", fontSize: 24, fill: "#000" },
					{ id: "image", type: "image", x: 0, y: 0, width: 100, height: 100, cropX: 200 }
				]
			});
		};
		request.onsuccess = () => {
			request.result.close();
			resolve();
		};
		request.onerror = () => reject(request.error);
	});
}
