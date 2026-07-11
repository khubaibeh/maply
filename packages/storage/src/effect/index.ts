export { IndexedDbOpenError, IndexedDbStoreError, type IndexedDbOperation } from "../indexed-db/errors";
export { IndexedDb, type IndexedDbStoreName } from "../indexed-db/service";
export { ProjectRepository } from "../project/repository";
export { StorageLayer, storageRuntime } from "./runtime";

import type { Project, StoredImageAsset } from "@maply/model/types";
import { Effect } from "effect";

import { ProjectRepository, type ResetProjectOptions } from "../project/repository";

export type { ResetProjectOptions } from "../project/repository";

export const project = {
	fetch: (id: string) => Effect.flatMap(ProjectRepository, (repo) => repo.fetch(id)),

	save: (value: Project) => Effect.flatMap(ProjectRepository, (repo) => repo.save(value)),

	replace: (value: Project, imageAssets: readonly StoredImageAsset[]) =>
		Effect.flatMap(ProjectRepository, (repo) => repo.replace(value, imageAssets)),

	reset: (options?: ResetProjectOptions) => Effect.flatMap(ProjectRepository, (repo) => repo.reset(options))
} as const;

export const imageAsset = {
	fetch: (ids: readonly string[]) => Effect.flatMap(ProjectRepository, (repo) => repo.fetchImageAssets(ids)),

	save: (asset: StoredImageAsset) => Effect.flatMap(ProjectRepository, (repo) => repo.saveImageAsset(asset)),

	delete: (id: string) => Effect.flatMap(ProjectRepository, (repo) => repo.deleteImageAsset(id))
} as const;
