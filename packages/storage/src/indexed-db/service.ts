import { Context, Effect, Layer } from "effect";

import { IndexedDbOpenError, IndexedDbStoreError, type IndexedDbOperation } from "./errors";

const dbDefinition = {
	name: "maply",
	version: 4,
	projects: "projects",
	imageAssets: "image-assets",
	projectIdIndex: "projectId"
} as const;

export type IndexedDbStoreName = (typeof dbDefinition)["projects"] | (typeof dbDefinition)["imageAssets"];

function open(): Effect.Effect<IDBDatabase, IndexedDbOpenError> {
	return Effect.tryPromise({
		try: () =>
			new Promise<IDBDatabase>((resolve, reject) => {
				const req = indexedDB.open(dbDefinition.name, dbDefinition.version);
				req.onerror = () => reject(req.error);

				req.onupgradeneeded = () => {
					const db = req.result;

					if (!db.objectStoreNames.contains(dbDefinition.projects)) {
						db.createObjectStore(dbDefinition.projects, { keyPath: "id" });
					}

					if (!db.objectStoreNames.contains(dbDefinition.imageAssets)) {
						const store = db.createObjectStore(dbDefinition.imageAssets, { keyPath: "id" });
						store.createIndex(dbDefinition.projectIdIndex, "projectId", { unique: false });
						return;
					}

					const store = req.transaction?.objectStore(dbDefinition.imageAssets);
					if (store && !store.indexNames.contains(dbDefinition.projectIdIndex)) {
						store.createIndex(dbDefinition.projectIdIndex, "projectId", { unique: false });
					}
				};

				req.onsuccess = () => resolve(req.result);
			}),
		catch: (error) =>
			new IndexedDbOpenError({
				database: dbDefinition.name,
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
			ids: readonly string[]
		) => Effect.Effect<Array<A>, IndexedDbOpenError | IndexedDbStoreError>;
		withTransaction: (
			stores: readonly IndexedDbStoreName[],
			mode: IDBTransactionMode,
			fn: (txn: IDBTransaction) => void
		) => Effect.Effect<void, IndexedDbOpenError | IndexedDbStoreError>;
	}
>()("storage/IndexedDb") {
	static readonly layer = Layer.effect(
		IndexedDb,
		Effect.sync(() => {
			let connection: Promise<IDBDatabase> | null = null;

			async function connectDb(): Promise<IDBDatabase> {
				try {
					const db = await Effect.runPromise(open());
					db.onversionchange = () => {
						db.close();
						connection = null;
					};

					db.onclose = () => {
						connection = null;
					};

					return db;
				} catch (error) {
					connection = null;
					throw error;
				}
			}

			const getDb = Effect.tryPromise({
				try: async () => {
					if (!connection) connection = connectDb();
					return await connection;
				},
				catch: (error) =>
					error instanceof IndexedDbOpenError
						? error
						: new IndexedDbOpenError({
								database: dbDefinition.name,
								message: error instanceof Error ? error.message : String(error)
							})
			});

			const get = <A>(store: IndexedDbStoreName, key: IDBValidKey) =>
				Effect.flatMap(getDb, (db) =>
					Effect.tryPromise({
						try: () =>
							new Promise<A | undefined>((resolve, reject) => {
								const txn = db.transaction(store, "readonly");
								const req = txn.objectStore(store).get(key);

								req.onsuccess = () => resolve(req.result as A | undefined);
								req.onerror = () => reject(req.error);
								txn.onerror = () => reject(txn.error);
								txn.onabort = () => reject(txn.error);
							}),
						catch: (error) => storeError(store, "get", error)
					})
				);

			const put = (store: IndexedDbStoreName, value: unknown) =>
				Effect.flatMap(getDb, (db) =>
					Effect.tryPromise({
						try: () =>
							new Promise<void>((resolve, reject) => {
								const txn = db.transaction(store, "readwrite");
								const req = txn.objectStore(store).put(value);

								txn.oncomplete = () => resolve();
								req.onerror = () => reject(req.error);
								txn.onerror = () => reject(txn.error);
								txn.onabort = () => reject(txn.error);
							}),
						catch: (error) => storeError(store, "put", error)
					})
				);

			const remove = (store: IndexedDbStoreName, key: IDBValidKey) =>
				Effect.flatMap(getDb, (db) =>
					Effect.tryPromise({
						try: () =>
							new Promise<void>((resolve, reject) => {
								const txn = db.transaction(store, "readwrite");
								const req = txn.objectStore(store).delete(key);

								txn.oncomplete = () => resolve();
								req.onerror = () => reject(req.error);
								txn.onerror = () => reject(txn.error);
								txn.onabort = () => reject(txn.error);
							}),
						catch: (error) => storeError(store, "delete", error)
					})
				);

			const getMany = <A>(store: IndexedDbStoreName, ids: readonly string[]) =>
				Effect.flatMap(getDb, (db) =>
					Effect.tryPromise({
						try: () =>
							new Promise<Array<A>>((resolve, reject) => {
								const txn = db.transaction(store, "readonly");
								const records = new Map<string, A>();

								txn.oncomplete = () =>
									resolve(
										ids
											.map((id) => records.get(id))
											.filter((record): record is A => record !== undefined)
									);
								txn.onerror = () => reject(txn.error);
								txn.onabort = () => reject(txn.error);

								for (const id of ids) {
									const req = txn.objectStore(store).get(id);

									req.onsuccess = () => {
										if (req.result) records.set(id, req.result as A);
									};
									req.onerror = () => reject(req.error);
								}
							}),
						catch: (error) => storeError(store, "getMany", error)
					})
				);

			const withTransaction = (
				stores: readonly IndexedDbStoreName[],
				mode: IDBTransactionMode,
				fn: (txn: IDBTransaction) => void
			) =>
				Effect.flatMap(getDb, (db) =>
					Effect.tryPromise({
						try: () =>
							new Promise<void>((resolve, reject) => {
								const txn = db.transaction([...stores], mode);

								txn.oncomplete = () => resolve();
								txn.onerror = () => reject(txn.error);
								txn.onabort = () => reject(txn.error);

								fn(txn);
							}),
						catch: (error) =>
							new IndexedDbStoreError({
								store: stores.join(","),
								operation: "transaction",
								message: error instanceof Error ? error.message : String(error)
							})
					})
				);

			return IndexedDb.of({ get, put, delete: remove, getMany, withTransaction });
		})
	);
}
