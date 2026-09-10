import { Deferred, Effect, MutableRef } from "effect";

import { EditorBusy } from "../session/errors";

/**
 * Synchronous document mutation gate.
 *
 * Bookkeeping uses `MutableRef` (synchronous, no runtime) because `document.ts`,
 * `canvas/commands.ts`, and `selection/delete.ts` test the gate from plain
 * synchronous UI code. A `Deferred` signals when admitted async mutations drain.
 */

const blockDepth: MutableRef.MutableRef<number> = MutableRef.make(0);
const internalDepth: MutableRef.MutableRef<number> = MutableRef.make(0);
const activeAsyncMutations: MutableRef.MutableRef<number> = MutableRef.make(0);

const settleLatch: MutableRef.MutableRef<Deferred.Deferred<void>> = MutableRef.make(makeSettledLatch());

/** Initial latch: already settled, so first session op proceeds immediately. */
function makeSettledLatch(): Deferred.Deferred<void> {
	const latch = Deferred.makeUnsafe<void>();
	Effect.runSync(Deferred.succeed(latch, undefined));
	return latch;
}

/** Admits one async editor mutation, or rejects it while a session operation is starting. */
function beginAsyncEditorMutation(): (() => void) | null {
	if (MutableRef.get(blockDepth) > 0) return null;
	if (MutableRef.get(activeAsyncMutations) === 0) {
		MutableRef.set(settleLatch, Deferred.makeUnsafe<void>());
	}
	MutableRef.update(activeAsyncMutations, (count) => count + 1);
	let released = false;
	return () => {
		if (released) return;
		released = true;
		MutableRef.update(activeAsyncMutations, (count) => count - 1);
		if (MutableRef.get(activeAsyncMutations) === 0) {
			Effect.runSync(Deferred.succeed(MutableRef.get(settleLatch), undefined));
		}
	};
}

/** Returns whether user-driven editor mutations must wait for a session operation. */
export function isEditorMutationBlocked(): boolean {
	return MutableRef.get(blockDepth) > 0 && MutableRef.get(internalDepth) === 0;
}

/** Allows trusted state restoration while user-driven mutations remain blocked. */
export function applyInternalEditorMutation(operation: () => void): void {
	MutableRef.update(internalDepth, (depth) => depth + 1);
	try {
		operation();
	} finally {
		MutableRef.update(internalDepth, (depth) => depth - 1);
	}
}

/**
 * Blocks user-driven editor mutations, drains admitted async mutations, then runs `operation`.
 */
export const withEditorMutationBlockEffect = Effect.fn("editor.mutationGate.block")(function* <A, E, R>(
	operation: Effect.Effect<A, E, R>
): Effect.fn.Return<A, E, R> {
	MutableRef.update(blockDepth, (depth) => depth + 1);
	return yield* Deferred.await(MutableRef.get(settleLatch)).pipe(
		Effect.andThen(operation),
		Effect.ensuring(Effect.sync(() => MutableRef.update(blockDepth, (depth) => depth - 1)))
	);
});

/**
 * Runs trusted store restoration with the gate's internal depth raised.
 */
export const applyInternalEditorMutationEffect = Effect.fn("editor.mutationGate.internal")(function* <A, E, R>(
	operation: Effect.Effect<A, E, R>
): Effect.fn.Return<A, E, R> {
	MutableRef.update(internalDepth, (depth) => depth + 1);
	return yield* operation.pipe(
		Effect.ensuring(Effect.sync(() => MutableRef.update(internalDepth, (depth) => depth - 1)))
	);
});

/** Runs one admitted async mutation and releases its lease on every exit path. */
export function withAsyncEditorMutationEffect<A, E, R>(
	operation: Effect.Effect<A, E, R>
): Effect.Effect<A, E | EditorBusy, R> {
	return Effect.suspend((): Effect.Effect<A, E | EditorBusy, R> => {
		const release = beginAsyncEditorMutation();
		if (!release) return Effect.fail(new EditorBusy({}));
		return operation.pipe(Effect.ensuring(Effect.sync(release)));
	});
}
