import type { Element, Point } from "@maply/model/types";

import { getElementBounds } from "../elements/geometry";
import type { ElementNameValidation } from "../elements/naming";
import { clearTextLayoutCache, invalidateTextLayout } from "../elements/text";
import { createDerivedIndexes, type DerivedIndexes } from "./derived-indexes";
import type { DocumentChangeListener, DocumentChangeSet, DocumentElementChange } from "./document-change";
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

function textLayoutChanged(before: Element, after: Element): boolean {
	if (before.type !== "text" && after.type !== "text") return false;
	if (before.type !== "text" || after.type !== "text") return true;
	return before.text !== after.text || before.fontSize !== after.fontSize || before.width !== after.width;
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

	function insertElement(element: Element, index: number): void {
		if (byId.has(element.id)) throw new Error(`Duplicate element ID: ${element.id}`);
		const copy = copyElement(element);
		byId.set(element.id, copy);
		const bounds = getElementBounds(copy);
		boundsById.set(element.id, bounds);
		geometryKeys.set(element.id, geometryKey(copy));
		spatial.set(element.id, bounds);
		order.splice(index, 0, element.id);
		refreshOrderIndexes();
	}

	function publish(change: DocumentChangeSet): DocumentChangeSet {
		currentRevision += 1;
		const published = { ...change, revision: currentRevision };
		derived.apply(published);
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
			if (textLayoutChanged(current, copy)) invalidateTextLayout(id);
			const nextGeometryKey = geometryKey(copy);
			if (geometryKeys.get(id) !== nextGeometryKey) {
				const bounds = getElementBounds(copy);
				boundsById.set(id, bounds);
				geometryKeys.set(id, nextGeometryKey);
				spatial.set(id, bounds);
			}
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
				if (change.before && textLayoutChanged(change.before, copy)) invalidateTextLayout(change.id);
				const nextGeometryKey = geometryKey(copy);
				if (geometryKeys.get(change.id) !== nextGeometryKey) {
					const bounds = getElementBounds(copy);
					boundsById.set(change.id, bounds);
					geometryKeys.set(change.id, nextGeometryKey);
					spatial.set(change.id, bounds);
				}
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
				const element = byId.get(id);
				byId.delete(id);
				spatial.delete(id);
				orderIndexes.delete(id);
				boundsById.delete(id);
				geometryKeys.delete(id);
				if (element?.type === "text") invalidateTextLayout(id);
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
			boundsById.clear();
			geometryKeys.clear();
			spatial.clear();
			clearTextLayoutCache();
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
