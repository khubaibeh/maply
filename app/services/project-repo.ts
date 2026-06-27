import { Context, Effect, Layer } from "effect";

import { createDefaultProject } from "../domain/defaults";
import type { StoredImageAsset } from "../domain/image-assets";
import type { Project } from "../domain/project";
import { IndexedDbOpenError, IndexedDbStoreError } from "../errors/persistence-errors";
import { IndexedDb } from "./indexed-db";

const IDS = {
	default: "default",
	prod: "prod"
} as const;

export type ResetProjectOptions = {
	elements?: "sample" | "blank";
};

function cloneProject(project: Project): Project {
	return structuredClone(project);
}

function mergeProject(defaultProject: Project, record: Project): Project {
	return {
		...defaultProject,
		...record,
		canvas: {
			...defaultProject.canvas,
			...record.canvas
		},
		camera: record.camera ? { ...defaultProject.camera, ...record.camera } : undefined,
		elements: record.elements ?? defaultProject.elements,
		importExportState: {
			...defaultProject.importExportState,
			...record.importExportState
		}
	};
}
export class ProjectRepo extends Context.Service<
	ProjectRepo,
	{
		fetchProject: (id: string) => Effect.Effect<Project, IndexedDbOpenError | IndexedDbStoreError>;
		saveProject: (project: Project) => Effect.Effect<void, IndexedDbOpenError | IndexedDbStoreError>;
		fetchImageAssets: (
			ids: ReadonlyArray<string>
		) => Effect.Effect<Array<StoredImageAsset>, IndexedDbOpenError | IndexedDbStoreError>;
		saveImageAsset: (asset: StoredImageAsset) => Effect.Effect<void, IndexedDbOpenError | IndexedDbStoreError>;
		replaceProject: (
			project: Project,
			imageAssets: ReadonlyArray<StoredImageAsset>
		) => Effect.Effect<void, IndexedDbOpenError | IndexedDbStoreError>;
		deleteImageAsset: (id: string) => Effect.Effect<void, IndexedDbOpenError | IndexedDbStoreError>;
		resetProject: (
			options?: ResetProjectOptions
		) => Effect.Effect<Project, IndexedDbOpenError | IndexedDbStoreError>;
	}
>()("app/ProjectRepo") {
	static readonly layer = Layer.effect(
		ProjectRepo,
		Effect.gen(function* () {
			const db = yield* IndexedDb;

			const fetchProject = Effect.fn("ProjectRepo.fetchProject")(function* (id: string) {
				const defaultId = IDS.default;
				const prodId = IDS.prod;

				if (typeof indexedDB === "undefined") {
					return createDefaultProject(id === defaultId ? defaultId : prodId);
				}

				const defaultProject = createDefaultProject(defaultId);
				yield* db.put("projects", cloneProject(defaultProject));

				const projectId = id === defaultId ? defaultId : prodId;
				const record = yield* db.get<Project>("projects", projectId);

				if (projectId === defaultId) {
					return defaultProject;
				}

				if (!record) {
					const prodProject = createDefaultProject(prodId);
					yield* db.put("projects", cloneProject(prodProject));
					return prodProject;
				}

				const defaults = createDefaultProject(prodId);
				const merged = mergeProject(defaults, record);
				yield* db.put("projects", cloneProject(merged));
				return merged;
			});

			const saveProject = (project: Project) =>
				Effect.gen(function* () {
					if (typeof indexedDB === "undefined") return;
					if (project.id === IDS.default) return;

					yield* db.put("projects", cloneProject(project));
				});

			const fetchImageAssets = (ids: ReadonlyArray<string>) =>
				Effect.gen(function* () {
					if (typeof indexedDB === "undefined" || ids.length === 0) return [];

					return yield* db.getMany<StoredImageAsset>("image-assets", ids);
				});

			const saveImageAsset = (asset: StoredImageAsset) =>
				Effect.gen(function* () {
					if (typeof indexedDB === "undefined") return;

					yield* db.put("image-assets", asset);
				});

			const replaceProject = (project: Project, imageAssets: ReadonlyArray<StoredImageAsset>) =>
				Effect.gen(function* () {
					if (typeof indexedDB === "undefined") return;
					if (project.id === IDS.default) return;

					yield* db.put("projects", cloneProject(project));
					yield* db.deleteByIndex("image-assets", "projectId", project.id);
					yield* Effect.forEach(imageAssets, (asset) => db.put("image-assets", asset), {
						discard: true
					});
				});

			const deleteImageAsset = (id: string) =>
				Effect.gen(function* () {
					if (typeof indexedDB === "undefined") return;

					yield* db.delete("image-assets", id);
				});

			const resetProject = (options: ResetProjectOptions = {}) =>
				Effect.gen(function* () {
					const prodId = IDS.prod;

					if (typeof indexedDB === "undefined") {
						const fallback = createDefaultProject(prodId);
						return options.elements === "blank" ? { ...fallback, elements: [] } : fallback;
					}

					yield* db.delete("projects", prodId);
					yield* db.deleteByIndex("image-assets", "projectId", prodId);

					const project = createDefaultProject(prodId);
					if (options.elements === "blank") {
						project.elements = [];
					}

					yield* db.put("projects", cloneProject(project));
					return project;
				});

			return ProjectRepo.of({
				fetchProject,
				saveProject,
				fetchImageAssets,
				saveImageAsset,
				replaceProject,
				deleteImageAsset,
				resetProject
			});
		})
	);
}
