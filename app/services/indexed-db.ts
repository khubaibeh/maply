import { Context, Effect, Layer } from "effect";

import { IndexedDbOpenError, IndexedDbStoreError, type IndexedDbOperation } from "../errors/persistence-errors";

const DB = {
	name: "maply",
	version: 4,
	projects: "projects",
	imageAssets: "image-assets",
	projectIdIndex: "projectId"
} as const;

export type IndexedDbStoreName = (typeof DB)["projects"] | (typeof DB)["imageAssets"];

function open(): Effect.Effect<IDBDatabase, IndexedDbOpenError> {
	return Effect.tryPromise({
		try: () =>
			new Promise<IDBDatabase>((resolve, reject) => {
				const req = indexedDB.open(DB.name, DB.version);

				req.onerror = () => reject(req.error);

				req.onupgradeneeded = () => {
					const db = req.result;

					if (!db.objectStoreNames.contains(DB.projects)) {
						db.createObjectStore(DB.projects, { keyPath: "id" });
					}

					if (!db.objectStoreNames.contains(DB.imageAssets)) {
						const imageStore = db.createObjectStore(DB.imageAssets, { keyPath: "id" });
						imageStore.createIndex(DB.projectIdIndex, "projectId", { unique: false });
						return;
					}

					const txn = req.transaction;
					const imageStore = txn?.objectStore(DB.imageAssets);
					if (imageStore && !imageStore.indexNames.contains(DB.projectIdIndex)) {
						imageStore.createIndex(DB.projectIdIndex, "projectId", { unique: false });
					}
				};

				req.onsuccess = () => resolve(req.result);
			}),
		catch: (error) =>
			new IndexedDbOpenError({
				database: DB.name,
				message: error instanceof Error ? error.message : String(error)
			})
	});
}

function storeError(store: string, operation: IndexedDbOperation, error: unknown) {
	return new IndexedDbStoreError({
		store,
		operation,
		message: error instanceof Error ? error.message : String(error)
	});
}

export class IndexedDb extends Context.Service<
	IndexedDb,
	{
		get: <A>(
			store: IndexedDbStoreName,
			key: IDBValidKey
		) => Effect.Effect<A | undefined, IndexedDbOpenError | IndexedDbStoreError>;
		put: (
			store: IndexedDbStoreName,
			value: unknown
		) => Effect.Effect<void, IndexedDbOpenError | IndexedDbStoreError>;
		delete: (
			store: IndexedDbStoreName,
			key: IDBValidKey
		) => Effect.Effect<void, IndexedDbOpenError | IndexedDbStoreError>;
		getMany: <A>(
			store: IndexedDbStoreName,
			ids: ReadonlyArray<string>
		) => Effect.Effect<Array<A>, IndexedDbOpenError | IndexedDbStoreError>;
		deleteByIndex: (
			store: IndexedDbStoreName,
			indexName: string,
			key: IDBValidKey
		) => Effect.Effect<void, IndexedDbOpenError | IndexedDbStoreError>;
	}
>()("app/IndexedDb") {
	static readonly layer = Layer.effect(
		IndexedDb,
		Effect.sync(() => {
			let db: Promise<IDBDatabase> | null = null;

			/*
			 * The live connection is opened lazily once and then reused for the
			 * lifetime of the service layer.
			 */
			const getDb = Effect.tryPromise({
				try: async () => {
					if (!db) {
						db = Effect.runPromise(open());
					}

					return await db;
				},
				catch: (error) =>
					error instanceof IndexedDbOpenError
						? error
						: new IndexedDbOpenError({
								database: DB.name,
								message: error instanceof Error ? error.message : String(error)
							})
			});

			const get = <A>(
				store: IndexedDbStoreName,
				key: IDBValidKey
			): Effect.Effect<A | undefined, IndexedDbOpenError | IndexedDbStoreError> =>
				Effect.flatMap(getDb, (db) =>
					Effect.tryPromise({
						try: () =>
							new Promise<A | undefined>((resolve, reject) => {
								const txn = db.transaction(store, "readonly");
								const objectStore = txn.objectStore(store);
								const req = objectStore.get(key);

								/*
								 * This adapter owns both writes and reads for these stores, so the
								 * cast stays contained at the persistence seam.
								 */
								req.onsuccess = () => {
									resolve(req.result as A | undefined);
								};
								req.onerror = () => reject(req.error);
								txn.onerror = () => reject(txn.error);
								txn.onabort = () => reject(txn.error);
							}),
						catch: (error) => storeError(store, "get", error)
					})
				);

			const put = (
				store: IndexedDbStoreName,
				value: unknown
			): Effect.Effect<void, IndexedDbOpenError | IndexedDbStoreError> =>
				Effect.flatMap(getDb, (db) =>
					Effect.tryPromise({
						try: () =>
							new Promise<void>((resolve, reject) => {
								const txn = db.transaction(store, "readwrite");
								const objectStore = txn.objectStore(store);
								const req = objectStore.put(structuredClone(value));

								txn.oncomplete = () => resolve();
								req.onerror = () => reject(req.error);
								txn.onerror = () => reject(txn.error);
								txn.onabort = () => reject(txn.error);
							}),
						catch: (error) => storeError(store, "put", error)
					})
				);

			const remove = (
				store: IndexedDbStoreName,
				key: IDBValidKey
			): Effect.Effect<void, IndexedDbOpenError | IndexedDbStoreError> =>
				Effect.flatMap(getDb, (db) =>
					Effect.tryPromise({
						try: () =>
							new Promise<void>((resolve, reject) => {
								const txn = db.transaction(store, "readwrite");
								const objectStore = txn.objectStore(store);
								const req = objectStore.delete(key);

								txn.oncomplete = () => resolve();
								req.onerror = () => reject(req.error);
								txn.onerror = () => reject(txn.error);
								txn.onabort = () => reject(txn.error);
							}),
						catch: (error) => storeError(store, "delete", error)
					})
				);

			const getMany = <A>(
				store: IndexedDbStoreName,
				ids: ReadonlyArray<string>
			): Effect.Effect<Array<A>, IndexedDbOpenError | IndexedDbStoreError> =>
				Effect.flatMap(getDb, (db) =>
					Effect.tryPromise({
						try: () =>
							new Promise<Array<A>>((resolve, reject) => {
								const txn = db.transaction(store, "readonly");
								const objectStore = txn.objectStore(store);
								const records = new Map<string, A>();

								txn.oncomplete = () => {
									resolve(
										ids
											.map((id) => records.get(id))
											.filter((record): record is A => record !== undefined)
									);
								};
								txn.onerror = () => reject(txn.error);
								txn.onabort = () => reject(txn.error);

								for (const id of ids) {
									const req = objectStore.get(id);
									/*
									 * `getMany` rebuilds results in caller order while keeping the cast
									 * inside the adapter boundary.
									 */
									req.onsuccess = () => {
										if (req.result) {
											records.set(id, req.result as A);
										}
									};
									req.onerror = () => reject(req.error);
								}
							}),
						catch: (error) => storeError(store, "getMany", error)
					})
				);

			const deleteByIndex = (
				store: IndexedDbStoreName,
				indexName: string,
				key: IDBValidKey
			): Effect.Effect<void, IndexedDbOpenError | IndexedDbStoreError> =>
				Effect.flatMap(getDb, (db) =>
					Effect.tryPromise({
						try: () =>
							new Promise<void>((resolve, reject) => {
								const txn = db.transaction(store, "readwrite");
								const objectStore = txn.objectStore(store);
								const index = objectStore.index(indexName);
								const req = index.openCursor(IDBKeyRange.only(key));

								txn.oncomplete = () => resolve();
								txn.onerror = () => reject(txn.error);
								txn.onabort = () => reject(txn.error);

								req.onsuccess = () => {
									const cursor = req.result;
									if (!cursor) return;
									cursor.delete();
									cursor.continue();
								};
								req.onerror = () => reject(req.error);
							}),
						catch: (error) => storeError(store, "deleteByIndex", error)
					})
				);

			return IndexedDb.of({
				get,
				put,
				delete: remove,
				getMany,
				deleteByIndex
			});
		})
	);
}
