let blockDepth = 0;
let internalDepth = 0;
let activeAsyncMutations = 0;
let resolveAsyncMutations: (() => void) | null = null;
let asyncMutationsSettled = Promise.resolve();

/** Admits one async editor mutation, or rejects it while a session operation is starting. */
export function beginAsyncEditorMutation(): (() => void) | null {
	if (blockDepth > 0) return null;
	if (activeAsyncMutations === 0) {
		asyncMutationsSettled = new Promise<void>((resolve) => {
			resolveAsyncMutations = resolve;
		});
	}
	activeAsyncMutations += 1;
	let released = false;
	return () => {
		if (released) return;
		released = true;
		activeAsyncMutations -= 1;
		if (activeAsyncMutations !== 0) return;
		const resolve = resolveAsyncMutations;
		resolveAsyncMutations = null;
		resolve?.();
	};
}

/** Returns whether user-driven editor mutations must wait for a session operation. */
export function isEditorMutationBlocked(): boolean {
	return blockDepth > 0 && internalDepth === 0;
}

/** Blocks user-driven editor mutations while an async editor operation runs. */
export async function withEditorMutationBlock<T>(operation: () => Promise<T>): Promise<T> {
	blockDepth += 1;
	try {
		await asyncMutationsSettled;
		return await operation();
	} finally {
		blockDepth -= 1;
	}
}

/** Allows trusted state restoration while user-driven mutations remain blocked. */
export function applyInternalEditorMutation(operation: () => void): void {
	internalDepth += 1;
	try {
		operation();
	} finally {
		internalDepth -= 1;
	}
}
