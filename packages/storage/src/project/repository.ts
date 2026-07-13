import { createDefaultProject, createSampleProject } from "@maply/model";
import type { Project, StoredImageAsset } from "@maply/model/types";
import { Context, Effect, Layer } from "effect";

import { IndexedDbOpenError, IndexedDbStoreError } from "../indexed-db/errors";
import { IndexedDb } from "../indexed-db/service";

const ids = { default: "default", prod: "prod" } as const;

export type ResetProjectOptions = { elements?: "sample" | "blank" };

function mergeProject(defaultProject: Project, record: Project): Project {
	const { importExportState: _ignored, ...persisted } = record as Project & { importExportState?: unknown };
	void _ignored;

	return {
		...defaultProject,
		...persisted,
		canvas: { ...defaultProject.canvas, ...persisted.canvas },
		camera: persisted.camera ? { ...defaultProject.camera, ...persisted.camera } : undefined,
		elements: persisted.elements ?? defaultProject.elements
	};
}

export class ProjectRepository extends Context.Service<
	ProjectRepository,
	{
		fetch: (id: string) => Effect.Effect<Project, IndexedDbOpenError | IndexedDbStoreError>;
		save: (project: Project) => Effect.Effect<void, IndexedDbOpenError | IndexedDbStoreError>;
		fetchImageAssets: (
			ids: readonly string[]
		) => Effect.Effect<Array<StoredImageAsset>, IndexedDbOpenError | IndexedDbStoreError>;
		saveImageAsset: (asset: StoredImageAsset) => Effect.Effect<void, IndexedDbOpenError | IndexedDbStoreError>;
		replace: (
			project: Project,
			imageAssets: readonly StoredImageAsset[]
		) => Effect.Effect<void, IndexedDbOpenError | IndexedDbStoreError>;
		deleteImageAsset: (id: string) => Effect.Effect<void, IndexedDbOpenError | IndexedDbStoreError>;
		reset: (options?: ResetProjectOptions) => Effect.Effect<Project, IndexedDbOpenError | IndexedDbStoreError>;
	}
>()("storage/ProjectRepository") {
	static readonly layer = Layer.effect(
		ProjectRepository,
		Effect.gen(function* () {
			const db = yield* IndexedDb;

			const initialProject = (id: string) =>
				id === ids.default ? createDefaultProject(ids.default) : createSampleProject(ids.prod);

			const fetch = Effect.fn("ProjectRepository.fetch")(function* (id: string) {
				if (id === ids.default) return createDefaultProject(ids.default);

				const record = yield* db.get<Project>("projects", ids.prod);

				if (!record) {
					const project = initialProject(ids.prod);
					yield* db.put("projects", structuredClone(project));
					return project;
				}

				const project = mergeProject(createDefaultProject(ids.prod), record);
				yield* db.put("projects", structuredClone(project));
				return project;
			});

			const save = (project: Project) =>
				Effect.gen(function* () {
					if (project.id === ids.default) return;
					yield* db.put("projects", structuredClone(project));
				});

			const fetchImageAssets = (assetIds: readonly string[]) =>
				Effect.gen(function* () {
					if (assetIds.length === 0) return [];
					return yield* db.getMany<StoredImageAsset>("image-assets", assetIds);
				});

			const saveImageAsset = (asset: StoredImageAsset) => db.put("image-assets", structuredClone(asset));

			const replace = (project: Project, imageAssets: readonly StoredImageAsset[]) =>
				Effect.gen(function* () {
					if (project.id === ids.default) return;

					yield* db.withTransaction(["projects", "image-assets"], "readwrite", (txn) => {
						txn.objectStore("projects").put(structuredClone(project));

						const store = txn.objectStore("image-assets");
						const keys = store.index("projectId").getAllKeys(IDBKeyRange.only(project.id));

						keys.onsuccess = () => {
							for (const key of keys.result) store.delete(key);
							for (const asset of imageAssets) store.put(structuredClone(asset));
						};
					});
				});

			const deleteImageAsset = (id: string) => db.delete("image-assets", id);

			const reset = (options: ResetProjectOptions = {}) =>
				Effect.gen(function* () {
					const project =
						options.elements === "sample" ? createSampleProject(ids.prod) : createDefaultProject(ids.prod);

					yield* db.withTransaction(["projects", "image-assets"], "readwrite", (txn) => {
						txn.objectStore("projects").delete(ids.prod);

						const store = txn.objectStore("image-assets");
						const keys = store.index("projectId").getAllKeys(IDBKeyRange.only(ids.prod));

						keys.onsuccess = () => {
							for (const key of keys.result) store.delete(key);
						};

						txn.objectStore("projects").put(structuredClone(project));
					});

					return project;
				});

			return ProjectRepository.of({
				fetch,
				save,
				fetchImageAssets,
				saveImageAsset,
				replace,
				deleteImageAsset,
				reset
			});
		})
	);
}
