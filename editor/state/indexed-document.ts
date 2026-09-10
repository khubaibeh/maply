import type { Element, Point } from "@maply/model/types";

import { getElementBounds } from "../elements/geometry";
import { createSpatialIndex, type SpatialBounds } from "./spatial-index";

export type { SpatialBounds } from "./spatial-index";

/** Tags emitted by one atomic indexed-document mutation. */
export type DocumentChangeTag = "add" | "delete" | "update" | "reorder" | "replace";

/** Before and after values for one element touched by a document command. */
export type DocumentElementChange = {
	id: string;
	before: Element | null;
	after: Element | null;
};

/** Precise layer-order information for one document command. */
export type DocumentOrderChange =
	| { tag: "none" }
	| { tag: "insert"; ids: readonly string[]; index: number }
	| { tag: "remove"; ids: readonly string[]; indexes: readonly number[] }
	| { tag: "move"; ids: readonly string[]; fromIndexes: readonly number[]; toIndex: number }
	| { tag: "replace"; before: readonly string[]; after: readonly string[] };

/** The complete typed result of one indexed-document command. */
export type DocumentChangeSet = {
	tag: DocumentChangeTag;
	revision: number;
	changes: readonly DocumentElementChange[];
	order: DocumentOrderChange;
};

/** Callback notified once for each accepted document command. */
export type DocumentChangeListener = (change: DocumentChangeSet) => void;

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
	readonly add: (elements: readonly Element[], index?: number) => DocumentChangeSet | null;
	readonly update: (id: string, updater: (element: Element) => Element) => DocumentChangeSet | null;
	readonly updateMany: (ids: readonly string[], updater: (element: Element) => Element) => DocumentChangeSet | null;
	readonly delete: (ids: readonly string[]) => DocumentChangeSet | null;
	readonly reorder: (ids: readonly string[], toIndex: number) => DocumentChangeSet | null;
	readonly replace: (elements: readonly Element[]) => DocumentChangeSet;
	readonly subscribe: (listener: DocumentChangeListener) => () => void;
};

function copyElement(element: Element): Element {
	return { ...element };
}

function uniqueIds(ids: readonly string[]): string[] {
	return [...new Set(ids)];
}

function clampIndex(index: number, length: number): number {
	return Math.max(0, Math.min(length, Math.trunc(index)));
}

/** Creates an indexed document with private ID lookup and layer-order storage. */
export function createIndexedDocument(elements: readonly Element[] = []): IndexedDocument {
	const byId = new Map<string, Element>();
	const order: string[] = [];
	const orderIndexes = new Map<string, number>();
	const listeners = new Set<DocumentChangeListener>();
	const spatial = createSpatialIndex();
	let currentRevision = 0;

	function refreshOrderIndexes() {
		order.forEach((id, index) => orderIndexes.set(id, index));
	}

	function insertElement(element: Element, index: number): void {
		if (byId.has(element.id)) throw new Error(`Duplicate element ID: ${element.id}`);
		const copy = copyElement(element);
		byId.set(element.id, copy);
		spatial.set(element.id, getElementBounds(copy));
		order.splice(index, 0, element.id);
		refreshOrderIndexes();
	}

	function publish(change: DocumentChangeSet): DocumentChangeSet {
		currentRevision += 1;
		const published = { ...change, revision: currentRevision };
		for (const listener of listeners) listener(published);
		return published;
	}

	for (const element of elements) insertElement(element, order.length);

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
			for (const [offset, element] of elementsToAdd.entries()) insertElement(element, insertionIndex + offset);
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
			const copy = copyElement(next);
			byId.set(id, copy);
			spatial.set(id, getElementBounds(copy));
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
				const copy = copyElement(change.after);
				byId.set(change.id, copy);
				spatial.set(change.id, getElementBounds(copy));
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
				byId.delete(id);
				spatial.delete(id);
				orderIndexes.delete(id);
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
			const previousElements = document.snapshot();
			const before = [...order];
			byId.clear();
			order.splice(0, order.length);
			orderIndexes.clear();
			spatial.clear();
			for (const element of nextElements) insertElement(element, order.length);
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
		subscribe: (listener) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		}
	};

	return document;
}
