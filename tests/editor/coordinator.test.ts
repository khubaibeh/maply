import { copyProjectEditorData, createElementNameGrid } from "@maply/model";
import { storage } from "@maply/storage";
import type { StoredEditorProject } from "@maply/storage/types";
import {
	persistProjectEffect,
	runStorageEffect,
	settleEditorWrites,
	withEditorWriteGate
} from "editor/session/coordinator";
import { Effect } from "effect";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import { describe, expect, it } from "vitest";

Object.assign(globalThis, { IDBKeyRange, indexedDB });

function payload(id: string, name: string): StoredEditorProject {
	return {
		id,
		name,
		canvas: { width: 1, height: 1, color: "#ffffff", x: 0, y: 0 },
		camera: { x: 0, y: 0, zoom: 1 },
		elements: [],
		editorData: copyProjectEditorData({ elementNameGrid: createElementNameGrid() }),
		isElementNameImportOpen: true
	};
}

describe("editor session coordination", () => {
	it("serializes storage operations in enqueue order", async () => {
		const observed: number[] = [];
		const first = runStorageEffect(
			withEditorWriteGate(
				Effect.promise(
					() =>
						new Promise<number>((resolve) => {
							setTimeout(() => {
								observed.push(1);
								resolve(1);
							}, 20);
						})
				)
			)
		);
		const second = runStorageEffect(
			withEditorWriteGate(
				Effect.sync(() => {
					observed.push(2);
					return 2;
				})
			)
		);
		expect(await Promise.all([first, second])).toEqual([1, 2]);
		expect(observed).toEqual([1, 2]);
	});

	it("flushes a persisted project through the coordinator and storage runtime", async () => {
		await storage.project.reset({ elements: "blank" });

		await runStorageEffect(persistProjectEffect(payload("prod", "Persisted name"), []));

		const fetched = await storage.project.fetch("prod");
		expect(fetched.ok).toBe(true);
		if (!fetched.ok) return;
		expect(fetched.value.name).toBe("Persisted name");
	});

	it("settles behind queued writes", async () => {
		await storage.project.reset({ elements: "blank" });

		const queued = runStorageEffect(persistProjectEffect(payload("prod", "Settle target"), []));

		await runStorageEffect(settleEditorWrites);
		await queued;

		const fetched = await storage.project.fetch("prod");
		expect(fetched.ok).toBe(true);
		if (!fetched.ok) return;
		expect(fetched.value.name).toBe("Settle target");
	});
});
