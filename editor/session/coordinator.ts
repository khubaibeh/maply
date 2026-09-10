import type { StoredImageAsset } from "@maply/model/types";
import { imageAsset, project as projectStorage, ProjectRepository, storageRuntime } from "@maply/storage/effect";
import type { ResetProjectOptions, StoredEditorProject } from "@maply/storage/types";
import { Deferred, Effect, MutableRef, Semaphore, type Fiber } from "effect";

import { PersistenceFailed } from "./errors";
import type { PersistenceOperation } from "./errors";

/**
 * Effect-native coordination for editor storage writes and settle guarantees.
 *
 * Effect primitives used here:
 * - `Semaphore` serializes every persistence write; one write runs at a time.
 * - `Effect.fn` names each workflow for tracing.
 * - `@maply/storage/effect` plus `storageRuntime` replaces the Promise storage facade.
 * - Settling schedules a one-permit pass-through through the shared write gate, so
 *   `settleEditorWrites` completes only after every previously queued write finished.
 */

/** Serialized storage access: previously `saveChain` plus `acquireMutex`. */
const editorWriteGate = Semaphore.makeUnsafe(1);
const detachedWriteCount = MutableRef.make(0);
const detachedWriteLatch = MutableRef.make(makeSettledLatch());

function makeSettledLatch(): Deferred.Deferred<void> {
	const latch = Deferred.makeUnsafe<void>();
	Effect.runSync(Deferred.succeed(latch, undefined));
	return latch;
}

function beginDetachedWrite(): () => void {
	if (MutableRef.get(detachedWriteCount) === 0) {
		MutableRef.set(detachedWriteLatch, Deferred.makeUnsafe<void>());
	}
	MutableRef.update(detachedWriteCount, (count) => count + 1);
	let released = false;
	return () => {
		if (released) return;
		released = true;
		MutableRef.update(detachedWriteCount, (count) => count - 1);
		if (MutableRef.get(detachedWriteCount) === 0) {
			Effect.runSync(Deferred.succeed(MutableRef.get(detachedWriteLatch), undefined));
		}
	};
}

type ProjectRepositoryEffect<A, E = PersistenceFailed> = Effect.Effect<A, E, ProjectRepository>;

function mapPersistenceCause<A, E extends { readonly _tag: string }>(
	effect: Effect.Effect<A, E, ProjectRepository>,
	operation: PersistenceOperation
): ProjectRepositoryEffect<A, PersistenceFailed> {
	return Effect.mapError(effect, (cause) => new PersistenceFailed({ operation, cause }));
}

/** Maps a typed storage failure into the editor persistence error channel. */
export function withPersistenceError<A, E extends { readonly _tag: string }>(
	effect: Effect.Effect<A, E, ProjectRepository>,
	operation: PersistenceOperation
): ProjectRepositoryEffect<A, PersistenceFailed> {
	return mapPersistenceCause(effect, operation);
}

/** Replaces a complete project while the caller owns the editor write gate. */
export const replaceProjectEffect = Effect.fn("editor.coordinator.replaceProject")(function* (
	project: StoredEditorProject,
	assets: readonly StoredImageAsset[]
): Effect.fn.Return<void, PersistenceFailed, ProjectRepository> {
	return yield* mapPersistenceCause(projectStorage.replace(project, assets), "replaceProject");
});

/** Persists the complete project record and a replacement asset slice. */
export const persistProjectEffect = Effect.fn("editor.coordinator.persistProject")(function* (
	project: StoredEditorProject,
	assets: readonly StoredImageAsset[]
): Effect.fn.Return<void, PersistenceFailed, ProjectRepository> {
	return yield* Semaphore.withPermits(editorWriteGate, 1)(replaceProjectEffect(project, assets));
});

/** Persists the project record with the current asset set. */
export const saveProjectEffect = Effect.fn("editor.coordinator.saveProject")(function* (
	project: StoredEditorProject
): Effect.fn.Return<void, PersistenceFailed, ProjectRepository> {
	return yield* Semaphore.withPermits(
		editorWriteGate,
		1
	)(mapPersistenceCause(projectStorage.save(project), "saveProject"));
});

/** Fetches a project while the caller owns the editor write gate. */
export const fetchProjectEffect = Effect.fn("editor.coordinator.fetchProject")(function* (id: string) {
	return yield* mapPersistenceCause(projectStorage.fetch(id), "fetchProject");
});

/** Fetches image assets while the caller owns the editor write gate. */
export const fetchImageAssetsEffect = Effect.fn("editor.coordinator.fetchImageAssets")(function* (
	ids: readonly string[]
) {
	return yield* mapPersistenceCause(imageAsset.fetch(ids), "fetchImageAssets");
});

/** Saves one image asset while the caller owns the editor write gate. */
export const saveImageAssetEffect = Effect.fn("editor.coordinator.saveImageAsset")(function* (asset: StoredImageAsset) {
	return yield* mapPersistenceCause(imageAsset.save(asset), "saveImageAsset");
});

/** Removes one image asset while the caller owns the editor write gate. */
export const deleteImageAssetEffect = Effect.fn("editor.coordinator.deleteImageAsset")(function* (id: string) {
	return yield* mapPersistenceCause(imageAsset.delete(id), "deleteImageAsset");
});

/** Resets the project while the caller owns the editor write gate. */
export const resetProjectEffect = Effect.fn("editor.coordinator.resetProject")(function* (
	options?: ResetProjectOptions
) {
	return yield* mapPersistenceCause(projectStorage.reset(options), "resetProject");
});

/** Waits for registered detached writes, then schedules a pass-through behind queued writes. */
export const settleEditorWrites: Effect.Effect<void, never, never> = Effect.suspend(() =>
	Deferred.await(MutableRef.get(detachedWriteLatch)).pipe(
		Effect.andThen(Semaphore.withPermits(editorWriteGate, 1)(Effect.void))
	)
);

/** Exposes the shared write gate for callers that must serialize their own work. */
export function withEditorWriteGate<A, E, R>(self: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> {
	return Semaphore.withPermits(editorWriteGate, 1)(self);
}

/** Runtime boundary for @maply/storage: builds a storage-backed effect execution. */
export function runStorageEffect<A, E>(effect: Effect.Effect<A, E, ProjectRepository>): Promise<A> {
	return storageRuntime.runPromise(effect);
}

/** Starts a storage-backed Effect workflow without awaiting its result. */
export function forkStorageEffect<A, E>(effect: Effect.Effect<A, E, ProjectRepository>): Fiber.Fiber<A, E> {
	return storageRuntime.runFork(effect);
}

/**
 * Starts a detached write that settlement observes even if it has not yet acquired the write gate.
 */
export function forkEditorWriteEffect<A, E>(effect: Effect.Effect<A, E, ProjectRepository>): Fiber.Fiber<A, E> {
	const release = beginDetachedWrite();
	return forkStorageEffect(effect.pipe(Effect.ensuring(Effect.sync(release))));
}
