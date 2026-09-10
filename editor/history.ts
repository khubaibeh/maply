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
import { documentIndex, projectState, setProjectState } from "./state/document";
import { applyInternalEditorMutation, withEditorMutationBlockEffect } from "./state/editing";
import { getInteractionState, updateInteractionState } from "./state/interaction";
import { canvasState } from "./state/workspace";

const defaultLimit = 100;

/** Identifies the caller that owns an open history transaction. */
export type HistoryTransaction = symbol;

type HistoryState = {
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

type ObservedState = Omit<HistoryState, "elements" | "assets"> & {
	elements: readonly Element[];
	assets: Readonly<Record<string, StoredImageAsset>>;
};

type ElementChange = { id: string; before: Element | null; after: Element | null };
type AssetChange = { id: string; before: StoredImageAsset | null; after: StoredImageAsset | null };
type HistoryChange = {
	name: { before: string; after: string } | null;
	elementNameGrid: { before: ElementNameGrid; after: ElementNameGrid } | null;
	canvas: { before: HistoryState["canvas"]; after: HistoryState["canvas"] } | null;
	elements: readonly ElementChange[];
	order: { before: readonly string[]; after: readonly string[] } | null;
	assets: readonly AssetChange[];
};

function referencedAssets(ids: readonly string[], assets: Record<string, StoredImageAsset>) {
	const referenced: Record<string, StoredImageAsset> = {};
	for (const id of ids) {
		const asset = assets[id];
		if (asset) referenced[id] = asset;
	}
	return referenced;
}

function observeSnapshot(): ObservedState {
	const project = get(projectState);
	const canvas = get(canvasState);
	const assets = get(imageAssetState);
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
		assets: referencedAssets(documentIndex.referencedAssetIds(), assets)
	};
}

function sameRecord(left: Record<string, unknown>, right: Record<string, unknown>): boolean {
	const leftKeys = Object.keys(left);
	const rightKeys = Object.keys(right);
	if (leftKeys.length !== rightKeys.length) return false;
	return leftKeys.every((key) => left[key] === right[key]);
}

function sameGrid(left: ElementNameGrid, right: ElementNameGrid): boolean {
	if (left.headers.length !== right.headers.length || left.rows.length !== right.rows.length) return false;
	if (!left.headers.every((header, index) => header === right.headers[index])) return false;
	return left.rows.every((row, rowIndex) => {
		const other = right.rows[rowIndex];
		return other !== undefined && row.length === other.length && row.every((cell, index) => cell === other[index]);
	});
}

function projectForState(next: ObservedState) {
	const current = get(projectState);

	return {
		...current,
		name: next.name,
		elements: [...next.elements],
		elementNameGrid: next.elementNameGrid
	};
}

function interactionForState(next: ObservedState) {
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

function persistStateEffect(
	next: ObservedState,
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

function applyState(next: ObservedState): void {
	applyInternalEditorMutation(() => {
		const currentCanvas = get(canvasState);
		setProjectState(projectForState(next), "rescan");
		updateInteractionState(() => interactionForState(next));
		canvasState.set({ ...currentCanvas, ...next.canvas, camera: currentCanvas.camera });
		imageAssetState.set(structuredClone(next.assets));
	});
}

function orderedIds(elements: readonly Element[]): string[] {
	return elements.map((element) => element.id);
}

function sameCanvas(left: HistoryState["canvas"], right: HistoryState["canvas"]): boolean {
	return (
		left.x === right.x &&
		left.y === right.y &&
		left.width === right.width &&
		left.height === right.height &&
		left.color === right.color
	);
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
	return left.length === right.length && left.every((id, index) => id === right[index]);
}

function createHistoryChange(before: ObservedState, after: ObservedState): HistoryChange | null {
	const beforeElements = new Map(before.elements.map((element) => [element.id, element]));
	const afterElements = new Map(after.elements.map((element) => [element.id, element]));
	const elementChanges: ElementChange[] = [];
	for (const id of new Set([...beforeElements.keys(), ...afterElements.keys()])) {
		const previous = beforeElements.get(id) ?? null;
		const next = afterElements.get(id) ?? null;
		if (previous && next && (previous === next || sameRecord(previous, next))) continue;
		elementChanges.push({
			id,
			before: previous ? structuredClone(previous) : null,
			after: next ? structuredClone(next) : null
		});
	}

	const beforeOrder = orderedIds(before.elements);
	const afterOrder = orderedIds(after.elements);
	const beforeAssets = before.assets;
	const afterAssets = after.assets;
	const assetChanges: AssetChange[] = [];
	for (const id of new Set([...Object.keys(beforeAssets), ...Object.keys(afterAssets)])) {
		const previous = beforeAssets[id] ?? null;
		const next = afterAssets[id] ?? null;
		if (previous === next) continue;
		assetChanges.push({
			id,
			before: previous ? structuredClone(previous) : null,
			after: next ? structuredClone(next) : null
		});
	}

	const change: HistoryChange = {
		name: before.name === after.name ? null : { before: before.name, after: after.name },
		elementNameGrid: sameGrid(before.elementNameGrid, after.elementNameGrid)
			? null
			: { before: structuredClone(before.elementNameGrid), after: structuredClone(after.elementNameGrid) },
		canvas: sameCanvas(before.canvas, after.canvas)
			? null
			: { before: { ...before.canvas }, after: { ...after.canvas } },
		elements: elementChanges,
		order: sameIds(beforeOrder, afterOrder) ? null : { before: beforeOrder, after: afterOrder },
		assets: assetChanges
	};

	return change.name ||
		change.elementNameGrid ||
		change.canvas ||
		change.elements.length > 0 ||
		change.order ||
		change.assets.length > 0
		? change
		: null;
}

function applyHistoryChange(
	change: HistoryChange,
	direction: "before" | "after",
	current: ObservedState
): ObservedState {
	const elementsById = new Map(current.elements.map((element) => [element.id, element]));
	for (const elementChange of change.elements) {
		const element = elementChange[direction];
		if (element) elementsById.set(elementChange.id, element);
		else elementsById.delete(elementChange.id);
	}

	const ids = change.order?.[direction] ?? orderedIds(current.elements);
	const elements = ids.flatMap((id) => {
		const element = elementsById.get(id);
		return element ? [element] : [];
	});
	const assets = { ...current.assets };
	for (const assetChange of change.assets) {
		const asset = assetChange[direction];
		if (asset) assets[assetChange.id] = asset;
		else delete assets[assetChange.id];
	}

	return {
		...current,
		name: change.name?.[direction] ?? current.name,
		elementNameGrid: change.elementNameGrid?.[direction] ?? current.elementNameGrid,
		canvas: change.canvas?.[direction] ?? current.canvas,
		elements,
		assets
	};
}

/** Provides bounded editor undo and redo over persisted document state. */
export function createHistory(limit = defaultLimit) {
	const undoStack: HistoryChange[] = [];
	const redoStack: HistoryChange[] = [];
	const canUndoStore = writable(false);
	const canRedoStore = writable(false);
	let previous = observeSnapshot();
	let transaction: { token: HistoryTransaction; start: ObservedState } | null = null;
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
		const change = createHistoryChange(previous, current);
		if (!change) return;
		undoStack.push(change);
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
		const referenced = new Set(documentIndex.referencedAssetIds());
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
		const change = createHistoryChange(start, current);
		previous = current;
		if (change) {
			undoStack.push(change);
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
			applyState(start);
			previous = observeSnapshot();
		} finally {
			applying = false;
		}
	}

	function applyStateEffect(snapshot: ObservedState): Effect.Effect<void> {
		return Effect.sync(() => {
			applying = true;
		}).pipe(
			Effect.andThen(
				Effect.sync(() => {
					applyState(snapshot);
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
		from: HistoryChange[],
		to: HistoryChange[],
		expectedGeneration: number,
		expectedRevision: number
	) {
		const change = from.at(-1);
		if (!change) return;
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
		const current = observeSnapshot();
		const direction = from === undoStack ? "before" : "after";
		const next = applyHistoryChange(change, direction, current);
		to.push(change);
		yield* applyStateEffect(next);
		publish();
		const persisted = yield* Effect.match(persistStateEffect(next, context), {
			onFailure: (error) => {
				console.warn("Failed to persist history state:", error);
				return false;
			},
			onSuccess: () => true
		});
		if (persisted || MutableRef.get(revision) !== expectedRevision) return;

		yield* applyStateEffect(current);
		to.pop();
		from.push(change);
		publish();
	});

	function scheduleMove(from: HistoryChange[], to: HistoryChange[]): Promise<void> {
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
