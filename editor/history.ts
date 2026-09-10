import type { Camera, Element, ElementNameGrid, StoredImageAsset } from "@maply/model/types";
import { get, readonly, writable } from "svelte/store";

import { persistEditorProject, settleEditorSave } from "./session/save";
import { imageAssetState } from "./state/assets";
import { projectState, setProjectState } from "./state/document";
import { applyInternalEditorMutation, withEditorMutationBlock } from "./state/editing";
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
	const validIds = new Set(next.elements.map((element) => element.id));
	const selectedIds = current.selectedElementIds.filter((id) => validIds.has(id));
	const selectedId =
		current.selectedElementId && validIds.has(current.selectedElementId) ? current.selectedElementId : null;

	return {
		...current,
		name: next.name,
		elements: [...next.elements],
		elementNameGrid: next.elementNameGrid,
		selectedElementIds: selectedIds,
		selectedElementId: selectedId,
		hoveredElementId: null,
		cropEditingElementId: null
	};
}

async function persistSnapshot(
	next: HistorySnapshot,
	context: { id: string; camera: Camera; isElementNameImportOpen: boolean }
): Promise<boolean> {
	return persistEditorProject(
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
	let suspended = 0;
	let applying = false;
	let generation = 0;
	let revision = 0;
	let moveChain = Promise.resolve();

	function publish() {
		canUndoStore.set(undoStack.length > 0);
		canRedoStore.set(redoStack.length > 0);
	}

	function observe() {
		if (suspended > 0 || applying || transaction) return;
		const current = observeSnapshot();
		if (sameSnapshot(current, previous)) return;
		undoStack.push(cloneSnapshot(previous));
		if (undoStack.length > limit) undoStack.shift();
		redoStack.length = 0;
		previous = current;
		revision += 1;
		publish();
	}

	function begin(): HistoryTransaction {
		if (transaction) commit(transaction.token);
		const token = Symbol("history-transaction");
		transaction = { token, start: observeSnapshot() };
		return token;
	}

	function commit(token: HistoryTransaction | null): void {
		if (!transaction || transaction.token !== token) return;
		const { start } = transaction;
		transaction = null;
		const current = observeSnapshot();
		previous = current;
		if (sameSnapshot(start, current)) return;
		undoStack.push(cloneSnapshot(start));
		if (undoStack.length > limit) undoStack.shift();
		redoStack.length = 0;
		revision += 1;
		publish();
	}

	function cancel(token: HistoryTransaction | null): void {
		if (!transaction || transaction.token !== token) return;
		const { start } = transaction;
		transaction = null;
		applying = true;
		try {
			applySnapshot(cloneSnapshot(start));
			previous = observeSnapshot();
		} finally {
			applying = false;
		}
	}

	async function move(
		from: HistorySnapshot[],
		to: HistorySnapshot[],
		expectedGeneration: number,
		expectedRevision: number
	): Promise<void> {
		const next = from.at(-1);
		if (!next) return;
		await settleEditorSave();
		if (generation !== expectedGeneration || revision !== expectedRevision) return;
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
		applying = true;
		try {
			applySnapshot(next);
			previous = observeSnapshot();
		} finally {
			applying = false;
		}
		publish();
		const persisted = await persistSnapshot(next, context);
		if (persisted || revision !== expectedRevision) return;

		applying = true;
		try {
			applySnapshot(current);
			previous = observeSnapshot();
			to.pop();
			from.push(next);
		} finally {
			applying = false;
		}
		publish();
	}

	function scheduleMove(from: HistorySnapshot[], to: HistorySnapshot[]): Promise<void> {
		const expectedGeneration = generation;
		const expectedRevision = revision;
		const operation = moveChain.then(() =>
			withEditorMutationBlock(() => move(from, to, expectedGeneration, expectedRevision))
		);
		moveChain = operation.catch(() => undefined);
		return operation;
	}

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
			await moveChain;
			await settleEditorSave();
		},
		reset() {
			generation += 1;
			undoStack.length = 0;
			redoStack.length = 0;
			transaction = null;
			previous = observeSnapshot();
			publish();
		},
		async withoutRecording<T>(operation: () => Promise<T>): Promise<T> {
			suspended += 1;
			try {
				return await operation();
			} finally {
				suspended -= 1;
				previous = observeSnapshot();
			}
		}
	};
}

export const history = createHistory();
