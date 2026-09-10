import { storage } from "@maply/storage";
import { project as projectEffect, storageRuntime } from "@maply/storage/effect";
import type { ResetProjectOptions, StorageResult } from "@maply/storage/types";
import { Effect } from "effect";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import { beforeAll, describe, expect, it } from "vitest";

Object.assign(globalThis, { IDBKeyRange, indexedDB });

function asset(id: string) {
	return {
		id,
		projectId: "prod",
		name: id,
		mimeType: "image/png",
		dataUrl: "data:image/png;base64,",
		width: 1,
		height: 1
	};
}

async function value<A, E>(result: Promise<StorageResult<A, E>>) {
	const response = await result;
	expect(response.ok).toBe(true);
	if (!response.ok) throw response.error;
	return response.value;
}

beforeAll(async () => {
	await createVersion3Fixture();
	await value(storage.project.fetch("prod"));
});

describe("@maply/storage", () => {
	it("upgrades version 3 records and creates the image project index", async () => {
		const project = await value(storage.project.fetch("prod"));
		expect(project.name).toBe("Version 3 project");
		expect(project).not.toHaveProperty("importExportState");
		expect(project.editorData).toEqual({ elementNameGrid: { headers: ["Name"], rows: [[""]] } });
		expect(project.isElementNameImportOpen).toBe(true);
		expect(await value(storage.imageAsset.fetch(["legacy-asset"]))).toEqual([asset("legacy-asset")]);

		const db = await openDatabase();
		const txn = db.transaction("image-assets", "readonly");
		expect(txn.objectStore("image-assets").indexNames.contains("projectId")).toBe(true);
		db.close();
	});

	it("exports public types", () => {
		const options: ResetProjectOptions = { elements: "blank" };
		expect(options.elements).toBe("blank");
	});

	it("persists projects through the handled API", async () => {
		const project = await value(storage.project.fetch("prod"));
		const saved = {
			...project,
			name: "Persisted project",
			editorData: {
				elementNameGrid: {
					headers: ["Name", "State"],
					rows: [
						["pump", "on"],
						["", ""]
					]
				}
			},
			isElementNameImportOpen: false
		};

		await value(storage.project.save(saved));

		expect(await value(storage.project.fetch("prod"))).toMatchObject({
			name: "Persisted project",
			editorData: saved.editorData,
			isElementNameImportOpen: false
		});
	});

	it("persists one element through the incremental representation", async () => {
		const project = await value(storage.project.fetch("prod"));
		const element = {
			id: "incremental-rect",
			name: "incremental-rect",
			type: "rect" as const,
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

		await value(
			storage.project.saveIncremental(
				{
					id: project.id,
					name: project.name,
					canvas: project.canvas,
					camera: project.camera,
					editorData: project.editorData,
					isElementNameImportOpen: project.isElementNameImportOpen,
					order: [element.id],
					schemaVersion: 1
				},
				[
					{
						changes: [{ id: element.id, before: null, after: element }],
						order: { tag: "insert", ids: [element.id], index: 0 }
					}
				]
			)
		);

		expect((await value(storage.project.fetch("prod"))).elements).toEqual([element]);
	});

	it("rejects malformed stored editor data without replacing it", async () => {
		const project = await value(storage.project.fetch("prod"));
		const db = await openDatabase();
		const transaction = db.transaction(["projects", "project-meta"], "readwrite");
		transaction.objectStore("projects").put({
			...project,
			editorData: { elementNameGrid: { headers: ["Other"], rows: [[""]] } }
		});
		transaction.objectStore("project-meta").put({
			id: project.id,
			name: project.name,
			canvas: project.canvas,
			camera: project.camera,
			editorData: { elementNameGrid: { headers: ["Other"], rows: [[""]] } },
			isElementNameImportOpen: project.isElementNameImportOpen,
			order: [],
			schemaVersion: 1
		});
		await new Promise<void>((resolve, reject) => {
			transaction.oncomplete = () => resolve();
			transaction.onerror = () => reject(transaction.error);
		});
		db.close();

		const result = await storage.project.fetch("prod");
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.message).toBe("Stored element-name grid is invalid.");

		const check = await openDatabase();
		const read = check.transaction("projects", "readonly").objectStore("projects").get("prod");
		const stored = await new Promise<unknown>((resolve, reject) => {
			read.onsuccess = () => resolve(read.result);
			read.onerror = () => reject(read.error);
		});
		check.close();
		expect(stored).toMatchObject({ editorData: { elementNameGrid: { headers: ["Other"] } } });

		await value(storage.project.reset({ elements: "blank" }));
	});

	it("replaces existing project image assets", async () => {
		const project = await value(storage.project.fetch("prod"));
		await value(storage.project.replace(project, [asset("asset-1"), asset("asset-2")]));

		expect(await value(storage.imageAsset.fetch(["asset-2", "asset-1"]))).toEqual([
			asset("asset-2"),
			asset("asset-1")
		]);

		await value(storage.project.replace(project, [asset("asset-3")]));
		expect(await value(storage.imageAsset.fetch(["asset-1", "asset-2", "asset-3"]))).toEqual([asset("asset-3")]);
	});

	it("runs raw workflows through the storage runtime", async () => {
		const project = await storageRuntime.runPromise(projectEffect.fetch("default"));
		expect(project.id).toBe("default");
		await storageRuntime.runPromise(Effect.asVoid(projectEffect.reset({ elements: "sample" })));
	});
});

async function createVersion3Fixture(): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		const request = indexedDB.deleteDatabase("maply");
		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
	});

	await new Promise<void>((resolve, reject) => {
		const request = indexedDB.open("maply", 3);
		request.onupgradeneeded = () => {
			const projectStore = request.result.createObjectStore("projects", { keyPath: "id" });
			const imageStore = request.result.createObjectStore("image-assets", { keyPath: "id" });
			projectStore.put({
				id: "prod",
				name: "Version 3 project",
				canvas: { width: 800, height: 800, color: "#fff", x: 0, y: 0 },
				camera: { x: 0, y: 0, zoom: 1 },
				elements: [],
				// Legacy UI-only data is discarded on the first read/write cycle.
				importExportState: { importsOpen: false, elementsOpen: false }
			});
			imageStore.put(asset("legacy-asset"));
		};
		request.onsuccess = () => {
			request.result.close();
			resolve();
		};
		request.onerror = () => reject(request.error);
	});
}

function openDatabase(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open("maply", 5);
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}
