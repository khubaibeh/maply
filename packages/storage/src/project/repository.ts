import {
	copyProjectEditorData,
	createDefaultProject,
	createProjectEditorData,
	createSampleProject,
	getProjectEditorDataIssue
} from "@maply/model";
import type { Project, ProjectEditorData, StoredImageAsset } from "@maply/model/types";
import { Context, Effect, Layer } from "effect";

import { IndexedDbOpenError, IndexedDbStoreError } from "../indexed-db/errors";
import { IndexedDb } from "../indexed-db/service";

const ids = { default: "default", prod: "prod" } as const;

export type ResetProjectOptions = { elements?: "sample" | "blank" };
export type StoredEditorProject = Project & { editorData: ProjectEditorData; isElementNameImportOpen: boolean };
type PersistedProject = Project & {
	editorData?: unknown;
	isElementNameImportOpen?: unknown;
	importExportState?: unknown;
};

function isProjectEditorData(value: unknown): value is ProjectEditorData {
	if (typeof value !== "object" || value === null || !("elementNameGrid" in value)) return false;
	const grid = value.elementNameGrid;
	if (typeof grid !== "object" || grid === null || !("headers" in grid) || !("rows" in grid)) return false;
	if (!Array.isArray(grid.headers) || !grid.headers.every((header) => typeof header === "string")) return false;
	if (
		!Array.isArray(grid.rows) ||
		!grid.rows.every((row) => Array.isArray(row) && row.every((cell) => typeof cell === "string"))
	)
		return false;
	return getProjectEditorDataIssue({ elementNameGrid: { headers: grid.headers, rows: grid.rows } }) === null;
}

function withEditorData(project: Project): StoredEditorProject {
	return { ...project, editorData: createProjectEditorData(), isElementNameImportOpen: true };
}

function mergeProject(defaultProject: Project, record: PersistedProject): StoredEditorProject {
	const { importExportState: _ignored, ...persisted } = record;
	void _ignored;

	return {
		...defaultProject,
		...persisted,
		canvas: { ...defaultProject.canvas, ...persisted.canvas },
		camera: persisted.camera ? { ...defaultProject.camera, ...persisted.camera } : undefined,
		elements: persisted.elements ?? defaultProject.elements,
		editorData: copyProjectEditorData(
			isProjectEditorData(persisted.editorData) ? persisted.editorData : createProjectEditorData()
		),
		isElementNameImportOpen:
			typeof persisted.isElementNameImportOpen === "boolean"
				? persisted.isElementNameImportOpen
				: isLegacyImportOpen(persisted.editorData)
	};
}

function isLegacyImportOpen(value: unknown): boolean {
	return typeof value === "object" && value !== null && "isElementNameImportOpen" in value
		? value.isElementNameImportOpen === true
		: true;
}

export class ProjectRepository extends Context.Service<
	ProjectRepository,
	{
		fetch: (id: string) => Effect.Effect<StoredEditorProject, IndexedDbOpenError | IndexedDbStoreError>;
		save: (project: StoredEditorProject) => Effect.Effect<void, IndexedDbOpenError | IndexedDbStoreError>;
		fetchImageAssets: (
			ids: readonly string[]
		) => Effect.Effect<Array<StoredImageAsset>, IndexedDbOpenError | IndexedDbStoreError>;
		saveImageAsset: (asset: StoredImageAsset) => Effect.Effect<void, IndexedDbOpenError | IndexedDbStoreError>;
		replace: (
			project: StoredEditorProject,
			imageAssets: readonly StoredImageAsset[]
		) => Effect.Effect<void, IndexedDbOpenError | IndexedDbStoreError>;
		deleteImageAsset: (id: string) => Effect.Effect<void, IndexedDbOpenError | IndexedDbStoreError>;
		reset: (
			options?: ResetProjectOptions
		) => Effect.Effect<StoredEditorProject, IndexedDbOpenError | IndexedDbStoreError>;
	}
>()("storage/ProjectRepository") {
	static readonly layer = Layer.effect(
		ProjectRepository,
		Effect.gen(function* () {
			const db = yield* IndexedDb;

			const initialProject = (id: string) =>
				withEditorData(id === ids.default ? createDefaultProject(ids.default) : createSampleProject(ids.prod));

			const fetch = Effect.fn("ProjectRepository.fetch")(function* (id: string) {
				if (id === ids.default) return initialProject(ids.default);

				const record = yield* db.get<PersistedProject>("projects", ids.prod);

				if (!record) {
					const project = initialProject(ids.prod);
					yield* db.put("projects", structuredClone(project));
					return project;
				}
				if (record.editorData !== undefined && !isProjectEditorData(record.editorData))
					return yield* Effect.fail(
						new IndexedDbStoreError({
							store: "projects",
							operation: "get",
							message: "Stored element-name grid is invalid."
						})
					);

				const project = mergeProject(createDefaultProject(ids.prod), record);
				yield* db.put("projects", structuredClone(project));
				return project;
			});

			const save = (project: StoredEditorProject) =>
				Effect.gen(function* () {
					if (project.id === ids.default) return;
					const issue = getProjectEditorDataIssue(project.editorData);
					if (issue)
						return yield* Effect.fail(
							new IndexedDbStoreError({ store: "projects", operation: "put", message: issue })
						);
					yield* db.put("projects", structuredClone(project));
				});

			const fetchImageAssets = (assetIds: readonly string[]) =>
				Effect.gen(function* () {
					if (assetIds.length === 0) return [];
					return yield* db.getMany<StoredImageAsset>("image-assets", assetIds);
				});

			const saveImageAsset = (asset: StoredImageAsset) => db.put("image-assets", structuredClone(asset));

			const replace = (project: StoredEditorProject, imageAssets: readonly StoredImageAsset[]) =>
				Effect.gen(function* () {
					if (project.id === ids.default) return;
					const issue = getProjectEditorDataIssue(project.editorData);
					if (issue)
						return yield* Effect.fail(
							new IndexedDbStoreError({ store: "projects", operation: "put", message: issue })
						);

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
					const project = withEditorData(
						options.elements === "sample" ? createSampleProject(ids.prod) : createDefaultProject(ids.prod)
					);

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
