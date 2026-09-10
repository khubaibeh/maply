import type { Element, Point } from "@maply/model/types";

import { getElementBounds } from "../elements/geometry";
import type { ElementNameValidation } from "../elements/naming";
import { clearTextLayoutCache, invalidateTextLayout } from "../elements/text";
import { createDerivedIndexes, type DerivedIndexes } from "./derived-indexes";
import type {
	DocumentChangeListener,
	DocumentChangeSet,
	DocumentChangeTag,
	DocumentElementChange,
	DocumentOrderChange
} from "./document-change";
import { createSpatialIndex, type SpatialBounds } from "./spatial-index";

export type { SpatialBounds } from "./spatial-index";
export type {
	DocumentChangeListener,
	DocumentChangeSet,
	DocumentChangeTag,
	DocumentElementChange,
	DocumentOrderChange
} from "./document-change";

/** The deep module interface for indexed document access and mutation. */
export type IndexedDocument = {
	readonly size: () => number;
	readonly revision: () => number;
	readonly has: (id: string) => boolean;
	readonly get: (id: string) => Element | undefined;
	readonly ordered: () => Iterable<Element>;
	readonly snapshot: () => Element[];
	readonly query: (bounds: SpatialBounds, includeIds?: readonly string[]) => string[];
	readonly queryPoint: (point: Point) => string[];
	readonly bounds: (id: string) => SpatialBounds | undefined;
	readonly nameCounts: () => ReadonlyMap<string, number>;
	readonly validations: () => ReadonlyMap<string, ElementNameValidation>;
	readonly referencedAssetIds: () => readonly string[];
	readonly add: (elements: readonly Element[], index?: number) => DocumentChangeSet | null;
	readonly update: (id: string, updater: (element: Element) => Element) => DocumentChangeSet | null;
	readonly updateMany: (ids: readonly string[], updater: (element: Element) => Element) => DocumentChangeSet | null;
	readonly delete: (ids: readonly string[]) => DocumentChangeSet | null;
	readonly reorder: (ids: readonly string[], toIndex: number) => DocumentChangeSet | null;
	readonly replace: (elements: readonly Element[]) => DocumentChangeSet;
	readonly replay: (
		changes: readonly DocumentElementChange[],
		orders: readonly DocumentOrderChange[],
		direction: "before" | "after",
		options?: { persist?: boolean }
	) => DocumentChangeSet | null;
	readonly subscribe: (listener: DocumentChangeListener) => () => void;
};

function copyElement(element: Element): Element {
	return { ...element };
}

function uniqueIds(ids: readonly string[]): string[] {
	return [...new Set(ids)];
}

function assertUniqueElementIds(elements: readonly Element[]): void {
	const ids = new Set<string>();
	for (const element of elements) {
		if (ids.has(element.id)) throw new Error(`Duplicate element ID: ${element.id}`);
		ids.add(element.id);
	}
}

function clampIndex(index: number, length: number): number {
	return Math.max(0, Math.min(length, Math.trunc(index)));
}

function textLayoutChanged(before: Element, after: Element): boolean {
	if (before.type !== "text" && after.type !== "text") return false;
	if (before.type !== "text" || after.type !== "text") return true;
	return before.text !== after.text || before.fontSize !== after.fontSize || before.width !== after.width;
}

function sameElement(left: Element | null, right: Element | null): boolean {
	if (left === right) return true;
	if (!left || !right) return false;
	return JSON.stringify(left) === JSON.stringify(right);
}

/** Creates an indexed document with private ID lookup and layer-order storage. */
export function createIndexedDocument(elements: readonly Element[] = []): IndexedDocument {
	const byId = new Map<string, Element>();
	const order: string[] = [];
	const orderIndexes = new Map<string, number>();
	const boundsById = new Map<string, SpatialBounds>();
	const geometryKeys = new Map<string, string>();
	const listeners = new Set<DocumentChangeListener>();
	const spatial = createSpatialIndex();
	const derived: DerivedIndexes = createDerivedIndexes(elements);
	let currentRevision = 0;

	function geometryKey(element: Element): string {
		switch (element.type) {
			case "rect":
			case "image":
				return `${element.type}:${element.x}:${element.y}:${element.width}:${element.height}`;
			case "circle":
				return `circle:${element.cx}:${element.cy}:${element.r}`;
			case "path":
				return `path:${element.x}:${element.y}:${element.d}:${element.strokeWidth}`;
			case "text":
				return `text:${element.x}:${element.y}:${element.width}:${element.height}:${element.text}:${element.fontSize}`;
		}
	}

	function refreshOrderIndexes() {
		order.forEach((id, index) => orderIndexes.set(id, index));
	}

	function removeElement(id: string): void {
		const removed = byId.get(id);
		const index = order.indexOf(id);
		if (index >= 0) order.splice(index, 1);
		byId.delete(id);
		spatial.delete(id);
		orderIndexes.delete(id);
		boundsById.delete(id);
		geometryKeys.delete(id);
		if (removed?.type === "text") invalidateTextLayout(id);
	}

	function setElement(element: Element): void {
		const current = byId.get(element.id);
		const copy = copyElement(element);
		byId.set(element.id, copy);
		if (current && textLayoutChanged(current, copy)) invalidateTextLayout(element.id);
		const nextGeometryKey = geometryKey(copy);
		if (geometryKeys.get(element.id) !== nextGeometryKey) {
			const bounds = getElementBounds(copy);
			boundsById.set(element.id, bounds);
			geometryKeys.set(element.id, nextGeometryKey);
			spatial.set(element.id, bounds);
		}
	}

	function publish(change: DocumentChangeSet): DocumentChangeSet {
		currentRevision += 1;
		const published = { ...change, revision: currentRevision };
		derived.apply(published);
		for (const listener of listeners) listener(published);
		return published;
	}

	assertUniqueElementIds(elements);
	for (const element of elements) {
		setElement(element);
		order.push(element.id);
	}
	refreshOrderIndexes();

	const document: IndexedDocument = {
		size: () => order.length,
		revision: () => currentRevision,
		has: (id) => byId.has(id),
		get: (id) => {
			const element = byId.get(id);
			return element ? copyElement(element) : undefined;
		},
		query: (bounds, includeIds = []) => {
			const ids = new Set([...spatial.query(bounds), ...includeIds.filter((id) => byId.has(id))]);
			return [...ids].sort((left, right) => (orderIndexes.get(left) ?? 0) - (orderIndexes.get(right) ?? 0));
		},
		queryPoint: (point) =>
			spatial
				.queryPoint(point)
				.filter((id) => byId.has(id))
				.sort((left, right) => (orderIndexes.get(left) ?? 0) - (orderIndexes.get(right) ?? 0)),
		bounds: (id) => {
			const bounds = boundsById.get(id);
			return bounds ? { ...bounds } : undefined;
		},
		nameCounts: derived.nameCounts,
		validations: derived.validations,
		referencedAssetIds: derived.referencedAssetIds,
		ordered: () =>
			(function* orderedElements() {
				for (const id of order) {
					const element = byId.get(id);
					if (element) yield copyElement(element);
				}
			})(),
		snapshot: () =>
			order.flatMap((id) => {
				const element = byId.get(id);
				return element ? [copyElement(element)] : [];
			}),
		add: (elementsToAdd, index = order.length) => {
			if (elementsToAdd.length === 0) return null;
			const insertionIndex = clampIndex(index, order.length);
			const ids = elementsToAdd.map((element) => element.id);
			for (const element of elementsToAdd) {
				if (byId.has(element.id) || ids.indexOf(element.id) !== ids.lastIndexOf(element.id))
					throw new Error(`Duplicate element ID: ${element.id}`);
			}
			for (const element of elementsToAdd) {
				setElement(element);
			}
			order.splice(insertionIndex, 0, ...ids);
			refreshOrderIndexes();
			return publish({
				tag: "add",
				revision: currentRevision,
				changes: elementsToAdd.map((element) => ({
					id: element.id,
					before: null,
					after: copyElement(element)
				})),
				order: { tag: "insert", ids, index: insertionIndex }
			});
		},
		update: (id, updater) => {
			const current = byId.get(id);
			if (!current) return null;
			const next = updater(copyElement(current));
			if (next.id !== id) throw new Error(`Element update changed ID: ${id}`);
			setElement(next);
			return publish({
				tag: "update",
				revision: currentRevision,
				changes: [{ id, before: copyElement(current), after: copyElement(next) }],
				order: { tag: "none" }
			});
		},
		updateMany: (ids, updater) => {
			const changes: DocumentElementChange[] = [];
			for (const id of uniqueIds(ids)) {
				const current = byId.get(id);
				if (!current) continue;
				const next = updater(copyElement(current));
				if (next.id !== id) throw new Error(`Element update changed ID: ${id}`);
				changes.push({ id, before: copyElement(current), after: copyElement(next) });
			}
			if (changes.length === 0) return null;
			for (const change of changes) {
				if (!change.after) continue;
				setElement(change.after);
			}
			return publish({ tag: "update", revision: currentRevision, changes, order: { tag: "none" } });
		},
		delete: (ids) => {
			const requested = new Set(uniqueIds(ids));
			const removedIds = order.filter((id) => requested.has(id));
			if (removedIds.length === 0) return null;
			const indexes = removedIds.map((id) => order.indexOf(id));
			const changes = removedIds.flatMap((id) => {
				const element = byId.get(id);
				return element ? [{ id, before: copyElement(element), after: null }] : [];
			});
			for (const id of removedIds) {
				removeElement(id);
			}
			for (let index = order.length - 1; index >= 0; index -= 1) {
				if (requested.has(order[index] ?? "")) order.splice(index, 1);
			}
			refreshOrderIndexes();
			return publish({
				tag: "delete",
				revision: currentRevision,
				changes,
				order: { tag: "remove", ids: removedIds, indexes }
			});
		},
		reorder: (ids, toIndex) => {
			const requested = new Set(uniqueIds(ids));
			const movingIds = order.filter((id) => requested.has(id));
			if (movingIds.length === 0) return null;
			const fromIndexes = movingIds.map((id) => order.indexOf(id));
			const remaining = order.filter((id) => !requested.has(id));
			const insertionIndex = clampIndex(toIndex, remaining.length);
			const nextOrder = [...remaining.slice(0, insertionIndex), ...movingIds, ...remaining.slice(insertionIndex)];
			if (nextOrder.every((id, index) => id === order[index])) return null;
			order.splice(0, order.length, ...nextOrder);
			refreshOrderIndexes();
			return publish({
				tag: "reorder",
				revision: currentRevision,
				changes: [],
				order: { tag: "move", ids: movingIds, fromIndexes, toIndex: insertionIndex }
			});
		},
		replace: (nextElements) => {
			assertUniqueElementIds(nextElements);
			const previousElements = document.snapshot();
			const before = [...order];
			byId.clear();
			order.splice(0, order.length);
			orderIndexes.clear();
			boundsById.clear();
			geometryKeys.clear();
			spatial.clear();
			clearTextLayoutCache();
			for (const element of nextElements) {
				setElement(element);
				order.push(element.id);
			}
			refreshOrderIndexes();
			const previousById = new Map(previousElements.map((element) => [element.id, element]));
			const nextById = new Map(document.snapshot().map((element) => [element.id, element]));
			const changedIds = uniqueIds([...previousById.keys(), ...nextById.keys()]);
			return publish({
				tag: "replace",
				revision: currentRevision,
				changes: changedIds.map((id) => ({
					id,
					before: previousById.get(id) ?? null,
					after: nextById.get(id) ?? null
				})),
				order: { tag: "replace", before, after: [...order] }
			});
		},
		replay: (changes, orders, direction, options = {}) => {
			if (changes.length === 0 && orders.length === 0) return null;
			const affectedIds = new Set(changes.map((change) => change.id));
			const beforeElements = new Map<string, Element | null>();
			for (const id of affectedIds) {
				const element = byId.get(id);
				beforeElements.set(id, element ? copyElement(element) : null);
			}
			const beforeOrder = orders.length > 0 ? [...order] : null;

			for (const change of changes) {
				const target = direction === "before" ? change.before : change.after;
				if (target) {
					if (!byId.has(target.id)) order.push(target.id);
					setElement(target);
				} else removeElement(change.id);
			}

			const orderedOperations = direction === "before" ? [...orders].reverse() : orders;
			for (const operation of orderedOperations) applyReplayOrder(operation, direction === "before");
			refreshOrderIndexes();

			const replayedChanges = [...affectedIds].flatMap((id) => {
				const before = beforeElements.get(id) ?? null;
				const element = byId.get(id);
				const after = element ? copyElement(element) : null;
				return sameElement(before, after) ? [] : [{ id, before, after }];
			});
			const nextOrder = beforeOrder ? [...order] : null;
			const orderChange: DocumentOrderChange =
				beforeOrder && nextOrder
					? orders.length === 1
						? replayOrderChange(orders[0] ?? { tag: "none" }, direction, beforeOrder, nextOrder)
						: { tag: "replace", before: beforeOrder, after: nextOrder }
					: { tag: "none" };
			if (replayedChanges.length === 0 && orderChange.tag === "none") return null;

			const tag: DocumentChangeTag =
				orderChange.tag === "replace"
					? "replace"
					: orderChange.tag !== "none"
						? "reorder"
						: replayedChanges.every((change) => change.before === null)
							? "add"
							: replayedChanges.every((change) => change.after === null)
								? "delete"
								: "update";
			return publish({
				tag,
				revision: currentRevision,
				changes: replayedChanges,
				order: orderChange,
				...(options.persist === false ? { persist: false } : {})
			});
		},
		subscribe: (listener) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		}
	};

	return document;

	function applyReplayOrder(operation: DocumentOrderChange, inverse: boolean): void {
		if (operation.tag === "none") return;
		if (operation.tag === "replace") {
			order.splice(0, order.length, ...(inverse ? operation.before : operation.after));
			return;
		}
		if (operation.tag === "insert") {
			if (inverse) removeIds(operation.ids);
			else {
				removeIds(operation.ids);
				order.splice(operation.index, 0, ...operation.ids);
			}
			return;
		}
		if (operation.tag === "insertMany") {
			if (inverse) removeIds(operation.entries.map((entry) => entry.id));
			else {
				removeIds(operation.entries.map((entry) => entry.id));
				for (const entry of [...operation.entries].sort((left, right) => left.index - right.index))
					order.splice(entry.index, 0, entry.id);
			}
			return;
		}
		if (operation.tag === "remove") {
			if (inverse) {
				removeIds(operation.ids);
				const entries = operation.ids
					.map((id, index) => ({ id, index: operation.indexes[index] ?? 0 }))
					.sort((left, right) => left.index - right.index);
				for (const entry of entries) order.splice(entry.index, 0, entry.id);
			} else removeIds(operation.ids);
			return;
		}
		removeIds(operation.ids);
		if (inverse) {
			const entries = operation.ids
				.map((id, entryIndex) => ({ id, index: operation.fromIndexes[entryIndex] ?? 0 }))
				.sort((left, right) => left.index - right.index);
			for (const entry of entries) order.splice(entry.index, 0, entry.id);
		} else order.splice(operation.toIndex, 0, ...operation.ids);
	}

	function removeIds(ids: readonly string[]): void {
		const requested = new Set(ids);
		for (let index = order.length - 1; index >= 0; index -= 1) {
			if (requested.has(order[index] ?? "")) order.splice(index, 1);
		}
	}
}

function replayOrderChange(
	operation: DocumentOrderChange,
	direction: "before" | "after",
	before: readonly string[],
	after: readonly string[]
): DocumentOrderChange {
	if (direction === "after") return operation;
	if (operation.tag === "insert")
		return { tag: "remove", ids: [...operation.ids], indexes: operation.ids.map((id) => after.indexOf(id)) };
	if (operation.tag === "insertMany")
		return {
			tag: "remove",
			ids: operation.entries.map((entry) => entry.id),
			indexes: operation.entries.map((entry) => after.indexOf(entry.id))
		};
	if (operation.tag === "remove")
		return {
			tag: "insertMany",
			entries: operation.ids.map((id, index) => ({ id, index: operation.indexes[index] ?? 0 }))
		};
	if (operation.tag === "move") {
		return { tag: "replace", before: [...before], after: [...after] };
	}
	return { tag: "replace", before: [...after], after: [...before] };
}
