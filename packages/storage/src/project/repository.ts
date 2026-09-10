import {
	copyProjectEditorData,
	createDefaultProject,
	createProjectEditorData,
	createSampleProject,
	getProjectEditorDataIssue
} from "@maply/model";
import type { Element, Project, ProjectEditorData, StoredImageAsset } from "@maply/model/types";
import { Context, Effect, Layer } from "effect";

import { IndexedDbOpenError, IndexedDbStoreError } from "../indexed-db/errors";
import { IndexedDb } from "../indexed-db/service";

const ids = { default: "default", prod: "prod" } as const;

export type ResetProjectOptions = { elements?: "sample" | "blank" };
export type StoredEditorProject = Project & { editorData: ProjectEditorData; isElementNameImportOpen: boolean };
export type StoredProjectMetadata = Omit<StoredEditorProject, "elements"> & {
	order: readonly string[];
	schemaVersion: 1;
};
export type PersistedDocumentChange = {
	changes: readonly { id: string; before: Element | null; after: Element | null }[];
	order:
		| { tag: "none" }
		| { tag: "insert"; ids: readonly string[]; index: number }
		| { tag: "insertMany"; entries: readonly { id: string; index: number }[] }
		| { tag: "remove"; ids: readonly string[]; indexes: readonly number[] }
		| { tag: "move"; ids: readonly string[]; fromIndexes: readonly number[]; toIndex: number }
		| { tag: "replace"; before: readonly string[]; after: readonly string[] };
};
type PersistedProject = Project & {
	editorData?: unknown;
	isElementNameImportOpen?: unknown;
	importExportState?: unknown;
};
type PersistedElementRecord = { id: string; projectId: string; element: Element };

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

function metadataForProject(project: StoredEditorProject): StoredProjectMetadata {
	return {
		id: project.id,
		name: project.name,
		canvas: { ...project.canvas },
		camera: project.camera ? { ...project.camera } : undefined,
		editorData: copyProjectEditorData(project.editorData),
		isElementNameImportOpen: project.isElementNameImportOpen,
		order: project.elements.map((element) => element.id),
		schemaVersion: 1
	};
}

function putVersionedProject(txn: IDBTransaction, project: StoredEditorProject): void {
	const metadata = metadataForProject(project);
	txn.objectStore("project-meta").put(structuredClone(metadata));
	const store = txn.objectStore("project-elements");
	const keys = store.index("projectId").getAllKeys(IDBKeyRange.only(project.id));
	keys.onsuccess = () => {
		for (const key of keys.result) store.delete(key);
		for (const element of project.elements) {
			const record: PersistedElementRecord = { id: element.id, projectId: project.id, element };
			store.put(structuredClone(record));
		}
	};
}

function applyOrderChanges(order: readonly string[], change: PersistedDocumentChange["order"]): string[] {
	if (change.tag === "none") return [...order];
	if (change.tag === "insert") return [...order.slice(0, change.index), ...change.ids, ...order.slice(change.index)];
	if (change.tag === "insertMany") {
		const insertedIds = new Set(change.entries.map((entry) => entry.id));
		const next = order.filter((id) => !insertedIds.has(id));
		for (const entry of [...change.entries].sort((left, right) => left.index - right.index))
			next.splice(entry.index, 0, entry.id);
		return next;
	}
	if (change.tag === "remove") return order.filter((id) => !change.ids.includes(id));
	if (change.tag === "replace") return [...change.after];
	const moving = new Set(change.ids);
	const remaining = order.filter((id) => !moving.has(id));
	return [...remaining.slice(0, change.toIndex), ...change.ids, ...remaining.slice(change.toIndex)];
}

export class ProjectRepository extends Context.Service<
	ProjectRepository,
	{
		fetch: (id: string) => Effect.Effect<StoredEditorProject, IndexedDbOpenError | IndexedDbStoreError>;
		save: (project: StoredEditorProject) => Effect.Effect<void, IndexedDbOpenError | IndexedDbStoreError>;
		saveIncremental: (
			metadata: StoredProjectMetadata,
			changes: readonly PersistedDocumentChange[]
		) => Effect.Effect<void, IndexedDbOpenError | IndexedDbStoreError>;
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

				const metadata = yield* db.get<StoredProjectMetadata>("project-meta", ids.prod);
				if (metadata) {
					if (!isProjectEditorData(metadata.editorData))
						return yield* Effect.fail(
							new IndexedDbStoreError({
								store: "project-meta",
								operation: "get",
								message: "Stored element-name grid is invalid."
							})
						);
					const records = yield* db.getAll<PersistedElementRecord>("project-elements");
					const elementsById = new Map(
						records.filter((record) => record.projectId === id).map((record) => [record.id, record.element])
					);
					const elements = metadata.order.flatMap((elementId) => {
						const element = elementsById.get(elementId);
						return element ? [element] : [];
					});
					return mergeProject(createDefaultProject(ids.prod), { ...metadata, elements });
				}

				const record = yield* db.get<PersistedProject>("projects", ids.prod);

				if (!record) {
					const project = initialProject(ids.prod);
					yield* db.put("projects", structuredClone(project));
					yield* db.withTransaction(["project-meta", "project-elements"], "readwrite", (txn) => {
						putVersionedProject(txn, project);
					});
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
				yield* db.withTransaction(["project-meta", "project-elements"], "readwrite", (txn) => {
					putVersionedProject(txn, project);
				});
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
					yield* db.withTransaction(["projects", "project-meta", "project-elements"], "readwrite", (txn) => {
						txn.objectStore("projects").put(structuredClone(project));
						putVersionedProject(txn, project);
					});
				});

			const saveIncremental = (metadata: StoredProjectMetadata, changes: readonly PersistedDocumentChange[]) =>
				Effect.gen(function* () {
					if (metadata.id === ids.default) return;
					const current = yield* db.get<StoredProjectMetadata>("project-meta", metadata.id);
					let order = [...(current?.order ?? metadata.order)];
					for (const change of changes) order = applyOrderChanges(order, change.order);
					const nextMetadata = { ...metadata, order, schemaVersion: 1 as const };
					yield* db.withTransaction(["project-meta", "project-elements"], "readwrite", (txn) => {
						txn.objectStore("project-meta").put(structuredClone(nextMetadata));
						const store = txn.objectStore("project-elements");
						for (const change of changes) {
							for (const elementChange of change.changes) {
								if (elementChange.after) {
									const record: PersistedElementRecord = {
										id: elementChange.id,
										projectId: metadata.id,
										element: elementChange.after
									};
									store.put(structuredClone(record));
								} else store.delete(elementChange.id);
							}
						}
					});
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

					yield* db.withTransaction(
						["projects", "image-assets", "project-meta", "project-elements"],
						"readwrite",
						(txn) => {
							txn.objectStore("projects").put(structuredClone(project));
							putVersionedProject(txn, project);

							const store = txn.objectStore("image-assets");
							const keys = store.index("projectId").getAllKeys(IDBKeyRange.only(project.id));

							keys.onsuccess = () => {
								for (const key of keys.result) store.delete(key);
								for (const asset of imageAssets) store.put(structuredClone(asset));
							};
						}
					);
				});

			const deleteImageAsset = (id: string) => db.delete("image-assets", id);

			const reset = (options: ResetProjectOptions = {}) =>
				Effect.gen(function* () {
					const project = withEditorData(
						options.elements === "sample" ? createSampleProject(ids.prod) : createDefaultProject(ids.prod)
					);

					yield* db.withTransaction(
						["projects", "image-assets", "project-meta", "project-elements"],
						"readwrite",
						(txn) => {
							txn.objectStore("projects").delete(ids.prod);
							txn.objectStore("project-meta").delete(ids.prod);

							const store = txn.objectStore("image-assets");
							const keys = store.index("projectId").getAllKeys(IDBKeyRange.only(ids.prod));

							keys.onsuccess = () => {
								for (const key of keys.result) store.delete(key);
							};

							txn.objectStore("projects").put(structuredClone(project));
							putVersionedProject(txn, project);
						}
					);

					return project;
				});

			return ProjectRepository.of({
				fetch,
				save,
				saveIncremental,
				fetchImageAssets,
				saveImageAsset,
				replace,
				deleteImageAsset,
				reset
			});
		})
	);
}
