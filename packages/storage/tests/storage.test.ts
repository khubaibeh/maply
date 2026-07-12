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
		const saved = { ...project, name: "Persisted project" };

		await value(storage.project.save(saved));

		expect(await value(storage.project.fetch("prod"))).toMatchObject({ name: "Persisted project" });
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
		const request = indexedDB.open("maply", 4);
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}
