import type { StoredImageAsset } from "@maply/model/types";
import { Effect } from "effect";

import type {
	PersistedDocumentChange,
	ResetProjectOptions,
	StoredEditorProject,
	StoredProjectMetadata
} from "../project/repository";
import { ProjectRepository } from "../project/repository";
import { storageRuntime } from "./runtime";

export type StorageResult<A, E> = { ok: true; value: A } | { ok: false; error: E };

function handled<A, E, R>(effect: Effect.Effect<A, E, R>): Promise<StorageResult<A, E>> {
	return storageRuntime.runPromise(
		(effect as Effect.Effect<A, E, never>).pipe(
			Effect.match({
				onFailure: (error): StorageResult<A, E> => ({ ok: false, error }),
				onSuccess: (value): StorageResult<A, E> => ({ ok: true, value })
			})
		)
	);
}

export function fetchProject(id: string) {
	return handled(Effect.flatMap(ProjectRepository, (repo) => repo.fetch(id)));
}

export function saveProject(project: StoredEditorProject) {
	return handled(Effect.flatMap(ProjectRepository, (repo) => repo.save(project)));
}

export function saveIncrementalProject(metadata: StoredProjectMetadata, changes: readonly PersistedDocumentChange[]) {
	return handled(Effect.flatMap(ProjectRepository, (repo) => repo.saveIncremental(metadata, changes)));
}

export function fetchImageAssets(ids: readonly string[]) {
	return handled(Effect.flatMap(ProjectRepository, (repo) => repo.fetchImageAssets(ids)));
}

export function saveImageAsset(asset: StoredImageAsset) {
	return handled(Effect.flatMap(ProjectRepository, (repo) => repo.saveImageAsset(asset)));
}

export function replaceProject(project: StoredEditorProject, imageAssets: readonly StoredImageAsset[]) {
	return handled(Effect.flatMap(ProjectRepository, (repo) => repo.replace(project, imageAssets)));
}

export function deleteImageAsset(id: string) {
	return handled(Effect.flatMap(ProjectRepository, (repo) => repo.deleteImageAsset(id)));
}

export function resetProject(options?: ResetProjectOptions) {
	return handled(Effect.flatMap(ProjectRepository, (repo) => repo.reset(options)));
}
