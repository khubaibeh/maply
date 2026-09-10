import { copyProjectEditorData } from "@maply/model";
import type { StoredEditorProject } from "@maply/storage/types";
import { Effect, Fiber, MutableRef } from "effect";
import { get } from "svelte/store";

import { recordSaveRequest } from "../benchmark-counters";
import { projectState } from "../state/document";
import { canvasState } from "../state/workspace";
import { forkStorageEffect, runStorageEffect, saveProjectEffect, settleEditorWrites } from "./coordinator";

const saveGeneration = MutableRef.make(0);
const savePending = MutableRef.make(false);
let pendingSaveFiber: Fiber.Fiber<void, never> | null = null;

function cancelPendingSave(): void {
	if (pendingSaveFiber) {
		// SAFETY: This fiber only waits for the debounce. `saveGeneration` remains the correctness guard
		// if cancellation races with wakeup; immediate interruption merely releases the timer resource.
		pendingSaveFiber.interruptUnsafe();
	}
	pendingSaveFiber = null;
	MutableRef.update(saveGeneration, (value) => value + 1);
	MutableRef.set(savePending, false);
}

function currentProject(): StoredEditorProject {
	const project = get(projectState);
	const canvas = get(canvasState);

	return {
		id: project.id,
		name: project.name,
		canvas: {
			width: canvas.width,
			height: canvas.height,
			color: canvas.color,
			x: canvas.x,
			y: canvas.y
		},
		camera: { ...canvas.camera },
		elements: project.elements.map((element) => ({ ...element })),
		editorData: copyProjectEditorData({ elementNameGrid: project.elementNameGrid }),
		isElementNameImportOpen: project.isElementNameImportOpen
	};
}

const saveCurrentProjectEffect = Effect.fn("editor.session.saveCurrent")(function* () {
	yield* Effect.suspend(() =>
		Effect.match(saveProjectEffect(currentProject()), {
			onFailure: (error) => {
				console.warn("Failed to save project:", error.cause);
			},
			onSuccess: () => {}
		})
	);
});

/** Persists the current project through the coordinator, logging failures. */
function saveCurrentProject(): Promise<void> {
	recordSaveRequest();
	return runStorageEffect(saveCurrentProjectEffect());
}

/** Queues a debounced project save after editor session hydration completes. */
export function queueEditorSave(): void {
	if (!get(projectState).initialized) return;
	cancelPendingSave();
	const generation = MutableRef.get(saveGeneration);
	MutableRef.set(savePending, true);
	pendingSaveFiber = forkStorageEffect(
		Effect.sleep("500 millis").pipe(
			Effect.andThen(
				Effect.suspend(() => {
					if (MutableRef.get(saveGeneration) !== generation) return Effect.void;
					MutableRef.set(savePending, false);
					pendingSaveFiber = null;
					return saveCurrentProjectEffect();
				})
			)
		)
	);
}

/** Persists a pending debounce, then settles behind all queued project writes. */
export const settleEditorSaveEffect = Effect.fn("editor.session.settleSave")(function* () {
	if (MutableRef.get(savePending)) {
		cancelPendingSave();
		yield* saveCurrentProjectEffect();
		return;
	}
	yield* settleEditorWrites;
});

/** Cancels a pending debounce and persists the current project immediately. */
export async function flushEditorSave(): Promise<void> {
	if (get(projectState).initialized) {
		cancelPendingSave();
		await saveCurrentProject();
		return;
	}
	await runStorageEffect(settleEditorSaveEffect());
}
