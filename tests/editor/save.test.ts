import { storage } from "@maply/storage";
import { runStorageEffect } from "editor/session/coordinator";
import { persistPendingEditorChangesEffect } from "editor/session/save";
import { Effect } from "effect";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import { expect, it } from "vitest";

Object.assign(globalThis, { IDBKeyRange, indexedDB });

it("keeps incremental persistence failures in the Effect error channel", async () => {
	await storage.project.reset({ elements: "blank" });
	await openFutureDatabaseVersion();

	try {
		const failed = await runStorageEffect(
			Effect.match(persistPendingEditorChangesEffect(), {
				onFailure: () => true,
				onSuccess: () => false
			})
		);
		expect(failed).toBe(true);
	} finally {
		await deleteDatabase();
	}
});

function openFutureDatabaseVersion(): Promise<void> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open("maply", 6);
		request.onsuccess = () => {
			request.result.close();
			resolve();
		};
		request.onerror = () => reject(request.error);
	});
}

function deleteDatabase(): Promise<void> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.deleteDatabase("maply");
		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
	});
}
