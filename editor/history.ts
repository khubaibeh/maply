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
import { discardPendingEditorChanges, persistPendingEditorChangesEffect, settleEditorSaveEffect } from "./session/save";
import { imageAssetState } from "./state/assets";
import { documentIndex, projectState, replayIndexedDocument, setProjectState } from "./state/document";
import { applyInternalEditorMutation, withEditorMutationBlockEffect } from "./state/editing";
import type { DocumentChangeSet, DocumentOrderChange } from "./state/indexed-document";
import { updateInteractionState } from "./state/interaction";
import { canvasState } from "./state/workspace";

const defaultLimit = 100;

/** Identifies the caller that owns an open history transaction. */
export type HistoryTransaction = symbol;

type HistoryState = {
	name: string;
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

type ElementChange = { id: string; before: Element | null; after: Element | null };
type AssetChange = { id: string; before: StoredImageAsset | null; after: StoredImageAsset | null };
type HistoryChange = {
	name: { before: string; after: string } | null;
	elementNameGrid: { before: ElementNameGrid; after: ElementNameGrid } | null;
	canvas: { before: HistoryState["canvas"]; after: HistoryState["canvas"] } | null;
	elements: readonly ElementChange[];
	orders: readonly DocumentOrderChange[];
	assets: readonly AssetChange[];
};

type OpenTransaction = {
	token: HistoryTransaction;
	start: HistoryState;
	documentChanges: DocumentChangeSet[];
};

function referencedAssets(ids: readonly string[], assets: Record<string, StoredImageAsset>) {
	const referenced: Record<string, StoredImageAsset> = {};
	for (const id of ids) {
		const asset = assets[id];
		if (asset) referenced[id] = asset;
	}
	return referenced;
}

function observeSnapshot(): HistoryState {
	const project = get(projectState);
	const canvas = get(canvasState);
	const assets = get(imageAssetState);
	return {
		name: project.name,
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

function sameCanvas(left: HistoryState["canvas"], right: HistoryState["canvas"]): boolean {
	return (
		left.x === right.x &&
		left.y === right.y &&
		left.width === right.width &&
		left.height === right.height &&
		left.color === right.color
	);
}

function sameAsset(left: StoredImageAsset | null, right: StoredImageAsset | null): boolean {
	if (left === right) return true;
	if (!left || !right) return false;
	return sameRecord(left, right);
}

function copyOrderChange(order: DocumentOrderChange): DocumentOrderChange | null {
	if (order.tag === "none") return null;
	if (order.tag === "insert") return { tag: "insert", ids: [...order.ids], index: order.index };
	if (order.tag === "insertMany") {
		return { tag: "insertMany", entries: order.entries.map((entry) => ({ ...entry })) };
	}
	if (order.tag === "remove") return { tag: "remove", ids: [...order.ids], indexes: [...order.indexes] };
	if (order.tag === "move") {
		return {
			tag: "move",
			ids: [...order.ids],
			fromIndexes: [...order.fromIndexes],
			toIndex: order.toIndex
		};
	}
	return { tag: "replace", before: [...order.before], after: [...order.after] };
}

function collectDocumentChange(documentChanges: readonly DocumentChangeSet[]): {
	elements: ElementChange[];
	orders: DocumentOrderChange[];
} {
	const elements = new Map<string, ElementChange>();
	const orders: DocumentOrderChange[] = [];

	for (const documentChange of documentChanges) {
		for (const entry of documentChange.changes) {
			const current = elements.get(entry.id);
			if (!current) {
				elements.set(entry.id, {
					id: entry.id,
					before: entry.before ? structuredClone(entry.before) : null,
					after: entry.after ? structuredClone(entry.after) : null
				});
				continue;
			}
			current.after = entry.after ? structuredClone(entry.after) : null;
		}
		const order = copyOrderChange(documentChange.order);
		if (order) orders.push(order);
	}

	return {
		elements: [...elements.values()].filter(
			(change) =>
				!(change.before && change.after && sameRecord(change.before, change.after)) &&
				!(change.before === null && change.after === null)
		),
		orders
	};
}

function createHistoryChange(
	before: HistoryState,
	after: HistoryState,
	documentChanges: readonly DocumentChangeSet[]
): HistoryChange | null {
	const documentDelta = collectDocumentChange(documentChanges);
	const beforeAssets = before.assets;
	const afterAssets = after.assets;
	const assetChanges: AssetChange[] = [];
	for (const id of new Set([...Object.keys(beforeAssets), ...Object.keys(afterAssets)])) {
		const previous = beforeAssets[id] ?? null;
		const next = afterAssets[id] ?? null;
		if (sameAsset(previous, next)) continue;
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
		elements: documentDelta.elements,
		orders: documentDelta.orders,
		assets: assetChanges
	};

	return change.name ||
		change.elementNameGrid ||
		change.canvas ||
		change.elements.length > 0 ||
		change.orders.length > 0 ||
		change.assets.length > 0
		? change
		: null;
}

function metadataChanged(before: HistoryState, after: HistoryState): boolean {
	return (
		before.name !== after.name ||
		!sameGrid(before.elementNameGrid, after.elementNameGrid) ||
		!sameCanvas(before.canvas, after.canvas)
	);
}

function assetsChanged(change: HistoryChange): boolean {
	return change.assets.length > 0;
}

function nextMetadata(current: HistoryState, change: HistoryChange, direction: "before" | "after"): HistoryState {
	return {
		...current,
		name: change.name?.[direction] ?? current.name,
		elementNameGrid: change.elementNameGrid?.[direction] ?? current.elementNameGrid,
		canvas: change.canvas?.[direction] ?? current.canvas
	};
}

function nextState(current: HistoryState, change: HistoryChange, direction: "before" | "after"): HistoryState {
	const metadata = nextMetadata(current, change, direction);
	if (change.assets.length === 0) return metadata;

	const assets = { ...current.assets };
	for (const assetChange of change.assets) {
		const asset = assetChange[direction];
		if (asset) assets[assetChange.id] = asset;
		else delete assets[assetChange.id];
	}
	return { ...metadata, assets };
}

function applyMetadata(next: HistoryState): void {
	const currentProject = get(projectState);
	if (currentProject.name !== next.name || !sameGrid(currentProject.elementNameGrid, next.elementNameGrid)) {
		setProjectState(
			{
				...currentProject,
				name: next.name,
				elementNameGrid: next.elementNameGrid
			},
			"preserve"
		);
	}

	const currentCanvas = get(canvasState);
	if (!sameCanvas(next.canvas, currentCanvas)) {
		canvasState.set({ ...currentCanvas, ...next.canvas, camera: currentCanvas.camera });
	}

	updateInteractionState((state) => {
		const selectedElementIds = state.selectedElementIds.filter((id) => documentIndex.has(id));
		return {
			...state,
			selectedElementIds,
			selectedElementId:
				state.selectedElementId && documentIndex.has(state.selectedElementId) ? state.selectedElementId : null,
			hoveredElementId: null,
			cropEditingElementId: null
		};
	});
}

function applyAssets(next: HistoryState): void {
	const current = get(imageAssetState);
	if (sameRecord(current, next.assets)) return;
	imageAssetState.set(structuredClone(next.assets));
}

function persistStateEffect(
	next: HistoryState,
	context: { id: string; camera: Camera; isElementNameImportOpen: boolean }
) {
	return persistProjectEffect(
		{
			id: context.id,
			name: next.name,
			canvas: { ...next.canvas },
			camera: { ...context.camera },
			elements: documentIndex.snapshot(),
			editorData: { elementNameGrid: next.elementNameGrid },
			isElementNameImportOpen: context.isElementNameImportOpen
		},
		Object.values(next.assets)
	);
}

function applyHistoryChange(change: HistoryChange, direction: "before" | "after", persist: boolean): void {
	applyInternalEditorMutation(() => {
		replayIndexedDocument(change.elements, change.orders, direction, { persist });
		const current = observeSnapshot();
		const next = nextState(current, change, direction);
		applyMetadata(next);
		if (change.assets.length > 0) applyAssets(next);
	});
}

/** Provides bounded editor undo and redo over persisted document state. */
export function createHistory(limit = defaultLimit) {
	const undoStack: HistoryChange[] = [];
	const redoStack: HistoryChange[] = [];
	const canUndoStore = writable(false);
	const canRedoStore = writable(false);
	let previous = observeSnapshot();
	let transaction: OpenTransaction | null = null;
	const pendingDocumentChanges: DocumentChangeSet[] = [];
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
		const documentChanges = pendingDocumentChanges.splice(0);
		const current = observeSnapshot();
		const change = createHistoryChange(previous, current, documentChanges);
		previous = current;
		if (!change) return;
		undoStack.push(change);
		recordHistoryRecord();
		if (undoStack.length > limit) undoStack.shift();
		redoStack.length = 0;
		MutableRef.update(revision, (value) => value + 1);
		publish();
	}

	function begin(): HistoryTransaction {
		if (transaction) commit(transaction.token);
		const token = Symbol("history-transaction");
		transaction = { token, start: observeSnapshot(), documentChanges: [] };
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
		const { start, documentChanges } = transaction;
		transaction = null;
		const current = observeSnapshot();
		const change = createHistoryChange(start, current, documentChanges);
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
		const { start, documentChanges } = transaction;
		transaction = null;
		const change = createHistoryChange(start, observeSnapshot(), documentChanges);
		deferredAssetDeletions.clear();
		if (change) {
			applying = true;
			try {
				applyHistoryChange(change, "before", false);
				previous = observeSnapshot();
				discardPendingEditorChanges();
			} finally {
				applying = false;
			}
		} else previous = observeSnapshot();
	}

	function applyStateEffect(change: HistoryChange, direction: "before" | "after"): Effect.Effect<void> {
		return Effect.sync(() => {
			applying = true;
		}).pipe(
			Effect.andThen(
				Effect.sync(() => {
					applyHistoryChange(change, direction, true);
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
		const next = nextState(current, change, direction);
		to.push(change);
		yield* applyStateEffect(change, direction);
		publish();
		const persisted = yield* Effect.match(
			metadataChanged(current, next) || assetsChanged(change)
				? persistStateEffect(next, context)
				: persistPendingEditorChangesEffect(),
			{
				onFailure: (error) => {
					console.warn("Failed to persist history state:", error);
					discardPendingEditorChanges();
					return false;
				},
				onSuccess: () => true
			}
		);
		if (persisted || MutableRef.get(revision) !== expectedRevision) return;

		yield* applyStateEffect(change, direction === "before" ? "after" : "before");
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
						pendingDocumentChanges.length = 0;
						previous = observeSnapshot();
					})
				)
			);
		});
	}

	const settleEffect = Semaphore.withPermits(moveGate, 1)(settleEditorSaveEffect());

	documentIndex.subscribe((change) => {
		if (suspended > 0 || applying || change.persist === false) return;
		if (transaction) transaction.documentChanges.push(change);
		else pendingDocumentChanges.push(change);
	});
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
			pendingDocumentChanges.length = 0;
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
