import type { Camera, Element, ElementNameGrid, StoredImageAsset } from "@maply/model/types";
import { Effect, MutableRef, Semaphore } from "effect";
import { get, readonly, writable } from "svelte/store";

import { recordHistoryRecord } from "./benchmark-counters";
import {
	deleteImageAssetEffect,
	forkEditorWriteEffect,
	persistProjectEffect,
	runStorageEffect,
	withEditorWriteGate
} from "./session/coordinator";
import { settleEditorSaveEffect } from "./session/save";
import { imageAssetState } from "./state/assets";
import { projectState, setProjectState } from "./state/document";
import { applyInternalEditorMutation, withEditorMutationBlockEffect } from "./state/editing";
import { getInteractionState, updateInteractionState } from "./state/interaction";
import { canvasState } from "./state/workspace";

const defaultLimit = 100;

/** Identifies the caller that owns an open history transaction. */
export type HistoryTransaction = symbol;

type HistorySnapshot = {
	name: string;
	elements: readonly Element[];
	elementNameGrid: ElementNameGrid;
	canvas: {
		x: number;
		y: number;
		width: number;
		height: number;
		color: string;
	};
	assets: Record<string, StoredImageAsset>;
};

type ObservedSnapshot = Omit<HistorySnapshot, "elements" | "assets"> & {
	elements: readonly Element[];
	assets: Readonly<Record<string, StoredImageAsset>>;
};

function referencedAssets(elements: readonly Element[], assets: Record<string, StoredImageAsset>) {
	const ids = elements.flatMap((element) => (element.type === "image" && element.assetId ? [element.assetId] : []));
	const referenced: Record<string, StoredImageAsset> = {};
	for (const id of ids) {
		const asset = assets[id];
		if (asset) referenced[id] = asset;
	}
	return referenced;
}

function observeSnapshot(): ObservedSnapshot {
	const project = get(projectState);
	const canvas = get(canvasState);
	return {
		name: project.name,
		elements: project.elements,
		elementNameGrid: project.elementNameGrid,
		canvas: {
			x: canvas.x,
			y: canvas.y,
			width: canvas.width,
			height: canvas.height,
			color: canvas.color
		},
		assets: referencedAssets(project.elements, get(imageAssetState))
	};
}

function cloneSnapshot(value: ObservedSnapshot): HistorySnapshot {
	return structuredClone(value);
}

function sameRecord(left: Record<string, unknown>, right: Record<string, unknown>): boolean {
	const leftKeys = Object.keys(left);
	const rightKeys = Object.keys(right);
	if (leftKeys.length !== rightKeys.length) return false;
	return leftKeys.every((key) => left[key] === right[key]);
}

function sameElements(left: readonly Element[], right: readonly Element[]): boolean {
	if (left.length !== right.length) return false;
	return left.every((element, index) => {
		const other = right[index];
		return other !== undefined && (element === other || sameRecord(element, other));
	});
}

function sameGrid(left: ElementNameGrid, right: ElementNameGrid): boolean {
	if (left.headers.length !== right.headers.length || left.rows.length !== right.rows.length) return false;
	if (!left.headers.every((header, index) => header === right.headers[index])) return false;
	return left.rows.every((row, rowIndex) => {
		const other = right.rows[rowIndex];
		return other !== undefined && row.length === other.length && row.every((cell, index) => cell === other[index]);
	});
}

function sameSnapshot(left: ObservedSnapshot, right: ObservedSnapshot): boolean {
	return (
		left.name === right.name &&
		sameGrid(left.elementNameGrid, right.elementNameGrid) &&
		left.canvas.x === right.canvas.x &&
		left.canvas.y === right.canvas.y &&
		left.canvas.width === right.canvas.width &&
		left.canvas.height === right.canvas.height &&
		left.canvas.color === right.canvas.color &&
		sameElements(left.elements, right.elements) &&
		sameRecord(left.assets, right.assets)
	);
}

function projectForSnapshot(next: HistorySnapshot) {
	const current = get(projectState);

	return {
		...current,
		name: next.name,
		elements: [...next.elements],
		elementNameGrid: next.elementNameGrid
	};
}

function interactionForSnapshot(next: HistorySnapshot) {
	const current = getInteractionState();
	const validIds = new Set(next.elements.map((element) => element.id));
	const selectedElementIds = current.selectedElementIds.filter((id) => validIds.has(id));
	return {
		...current,
		selectedElementIds,
		selectedElementId:
			current.selectedElementId && validIds.has(current.selectedElementId) ? current.selectedElementId : null,
		hoveredElementId: null,
		cropEditingElementId: null
	};
}

function persistSnapshotEffect(
	next: HistorySnapshot,
	context: { id: string; camera: Camera; isElementNameImportOpen: boolean }
) {
	return persistProjectEffect(
		{
			id: context.id,
			name: next.name,
			canvas: { ...next.canvas },
			camera: { ...context.camera },
			elements: [...next.elements],
			editorData: { elementNameGrid: next.elementNameGrid },
			isElementNameImportOpen: context.isElementNameImportOpen
		},
		Object.values(next.assets)
	);
}

function applySnapshot(next: HistorySnapshot): void {
	applyInternalEditorMutation(() => {
		const currentCanvas = get(canvasState);
		setProjectState(projectForSnapshot(next), "rescan");
		updateInteractionState(() => interactionForSnapshot(next));
		canvasState.set({ ...currentCanvas, ...next.canvas, camera: currentCanvas.camera });
		imageAssetState.set(structuredClone(next.assets));
	});
}

/** Provides bounded editor undo and redo over persisted document state. */
export function createHistory(limit = defaultLimit) {
	const undoStack: HistorySnapshot[] = [];
	const redoStack: HistorySnapshot[] = [];
	const canUndoStore = writable(false);
	const canRedoStore = writable(false);
	let previous = observeSnapshot();
	let transaction: { token: HistoryTransaction; start: ObservedSnapshot } | null = null;
	const deferredAssetDeletions = new Set<string>();
	let suspended = 0;
	let applying = false;
	const generation = MutableRef.make(0);
	const revision = MutableRef.make(0);
	const moveGate = Semaphore.makeUnsafe(1);

	function publish() {
		canUndoStore.set(undoStack.length > 0);
		canRedoStore.set(redoStack.length > 0);
	}

	function observe() {
		if (suspended > 0 || applying || transaction) return;
		const current = observeSnapshot();
		if (sameSnapshot(current, previous)) return;
		undoStack.push(cloneSnapshot(previous));
		recordHistoryRecord();
		if (undoStack.length > limit) undoStack.shift();
		redoStack.length = 0;
		previous = current;
		MutableRef.update(revision, (value) => value + 1);
		publish();
	}

	function begin(): HistoryTransaction {
		if (transaction) commit(transaction.token);
		const token = Symbol("history-transaction");
		transaction = { token, start: observeSnapshot() };
		return token;
	}

	function scheduleAssetDeletion(assetId: string): void {
		void forkEditorWriteEffect(
			withEditorWriteGate(
				Effect.match(deleteImageAssetEffect(assetId), {
					onFailure: (error) => {
						console.warn("Failed to delete image asset:", error.cause);
					},
					onSuccess: () => {}
				})
			)
		);
	}

	function flushDeferredAssetDeletions(): void {
		const referenced = new Set(
			get(projectState).elements.flatMap((element) =>
				element.type === "image" && element.assetId ? [element.assetId] : []
			)
		);
		for (const assetId of deferredAssetDeletions) {
			if (!referenced.has(assetId)) scheduleAssetDeletion(assetId);
		}
		deferredAssetDeletions.clear();
	}

	function commit(token: HistoryTransaction | null): void {
		if (!transaction || transaction.token !== token) return;
		const { start } = transaction;
		transaction = null;
		const current = observeSnapshot();
		previous = current;
		if (!sameSnapshot(start, current)) {
			undoStack.push(cloneSnapshot(start));
			recordHistoryRecord();
			if (undoStack.length > limit) undoStack.shift();
			redoStack.length = 0;
			MutableRef.update(revision, (value) => value + 1);
			publish();
		}
		flushDeferredAssetDeletions();
	}

	function cancel(token: HistoryTransaction | null): void {
		if (!transaction || transaction.token !== token) return;
		const { start } = transaction;
		transaction = null;
		deferredAssetDeletions.clear();
		applying = true;
		try {
			applySnapshot(cloneSnapshot(start));
			previous = observeSnapshot();
		} finally {
			applying = false;
		}
	}

	function applySnapshotEffect(snapshot: HistorySnapshot): Effect.Effect<void> {
		return Effect.sync(() => {
			applying = true;
		}).pipe(
			Effect.andThen(
				Effect.sync(() => {
					applySnapshot(snapshot);
					previous = observeSnapshot();
				})
			),
			Effect.ensuring(
				Effect.sync(() => {
					applying = false;
				})
			)
		);
	}

	const move = Effect.fn("editor.history.move")(function* (
		from: HistorySnapshot[],
		to: HistorySnapshot[],
		expectedGeneration: number,
		expectedRevision: number
	) {
		const next = from.at(-1);
		if (!next) return;
		yield* settleEditorSaveEffect();
		if (MutableRef.get(generation) !== expectedGeneration || MutableRef.get(revision) !== expectedRevision) return;
		from.pop();
		const project = get(projectState);
		const canvas = get(canvasState);
		const context = {
			id: project.id,
			camera: canvas.camera,
			isElementNameImportOpen: project.isElementNameImportOpen
		};
		const current = cloneSnapshot(observeSnapshot());
		to.push(current);
		yield* applySnapshotEffect(next);
		publish();
		const persisted = yield* Effect.match(persistSnapshotEffect(next, context), {
			onFailure: (error) => {
				console.warn("Failed to persist history state:", error);
				return false;
			},
			onSuccess: () => true
		});
		if (persisted || MutableRef.get(revision) !== expectedRevision) return;

		yield* applySnapshotEffect(current);
		to.pop();
		from.push(next);
		publish();
	});

	function scheduleMove(from: HistorySnapshot[], to: HistorySnapshot[]): Promise<void> {
		const expectedGeneration = MutableRef.get(generation);
		const expectedRevision = MutableRef.get(revision);
		return runStorageEffect(
			Semaphore.withPermits(
				moveGate,
				1
			)(
				Effect.promise(() => Promise.resolve()).pipe(
					Effect.andThen(withEditorMutationBlockEffect(move(from, to, expectedGeneration, expectedRevision)))
				)
			)
		);
	}

	function withoutRecordingEffect<A, E, R>(operation: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> {
		return Effect.suspend(() => {
			suspended += 1;
			return operation.pipe(
				Effect.ensuring(
					Effect.sync(() => {
						suspended -= 1;
						previous = observeSnapshot();
					})
				)
			);
		});
	}

	const settleEffect = Semaphore.withPermits(moveGate, 1)(settleEditorSaveEffect());

	projectState.subscribe(observe);
	canvasState.subscribe(observe);
	imageAssetState.subscribe(observe);

	return {
		begin,
		commit,
		cancel,
		undo: () => scheduleMove(undoStack, redoStack),
		redo: () => scheduleMove(redoStack, undoStack),
		canUndo: readonly(canUndoStore),
		canRedo: readonly(canRedoStore),
		async settle(): Promise<void> {
			await runStorageEffect(settleEffect);
		},
		settleEffect,
		reset() {
			MutableRef.update(generation, (value) => value + 1);
			undoStack.length = 0;
			redoStack.length = 0;
			transaction = null;
			deferredAssetDeletions.clear();
			previous = observeSnapshot();
			publish();
		},
		deferAssetDeletion(assetId: string): boolean {
			if (!transaction) return false;
			deferredAssetDeletions.add(assetId);
			return true;
		},
		withoutRecordingEffect
	};
}

export const history = createHistory();
