import { createElementNameGrid } from "@maply/model";
import type { Element } from "@maply/model/types";
import { writable } from "svelte/store";

import { recordChangePublication, recordDocumentRevision } from "../benchmark-counters";
import { getElementBounds } from "../elements/geometry";
import type { ProjectState } from "../types";
import { isEditorMutationBlocked } from "./editing";
import { createIndexedDocument, type DocumentChangeSet, type IndexedDocument } from "./indexed-document";

const initialProjectState: ProjectState = {
	id: "prod",
	name: "Untitled",
	elements: [],
	elementNameGrid: createElementNameGrid(),
	isElementNameImportOpen: true,
	initialized: false
};

/** The default fill used by newly created fillable elements. */
export const fillState = writable("#e5e5e5");

/** The in-memory editor clipboard. Its contents are never persisted. */
export const clipboardState = writable<Element[]>([]);

export type MinimumCanvasSize = { width: number; height: number };
export type MinimumCanvasSizeHint =
	| "preserve"
	| "rescan"
	| { added: readonly Element[] }
	| { changed: { before: Element; after: Element } }
	| { deleted: readonly string[] };

type MinimumCanvasSizeCache = MinimumCanvasSize & {
	widthHolderId: string | null;
	heightHolderId: string | null;
};

function getElementSize(element: Element) {
	const bounds = getElementBounds(element);
	return {
		width: Math.max(1, Math.ceil(bounds.width)),
		height: Math.max(1, Math.ceil(bounds.height))
	};
}

function measureMinimumCanvasSizeCache(elements: readonly Element[]): MinimumCanvasSizeCache {
	let width = 1;
	let height = 1;
	let widthHolderId: string | null = null;
	let heightHolderId: string | null = null;

	for (const element of elements) {
		const size = getElementSize(element);
		if (size.width >= width) {
			width = size.width;
			widthHolderId = element.id;
		}
		if (size.height >= height) {
			height = size.height;
			heightHolderId = element.id;
		}
	}

	return { width, height, widthHolderId, heightHolderId };
}

function toMinimumCanvasSize(cache: MinimumCanvasSizeCache): MinimumCanvasSize {
	return { width: cache.width, height: cache.height };
}

function rescanMinimumCanvasSizeCache(_cache: MinimumCanvasSizeCache, _prev: ProjectState, next: ProjectState) {
	return measureMinimumCanvasSizeCache(next.elements);
}

function preserveMinimumCanvasSizeCache(cache: MinimumCanvasSizeCache) {
	return cache;
}

function trackAddedElementsMinimumCanvasSize(cache: MinimumCanvasSizeCache, added: readonly Element[]) {
	let next = cache;
	for (const element of added) {
		const size = getElementSize(element);
		if (size.width >= next.width) next = { ...next, width: size.width, widthHolderId: element.id };
		if (size.height >= next.height) next = { ...next, height: size.height, heightHolderId: element.id };
	}
	return next;
}

function trackChangedElementMinimumCanvasSize(
	cache: MinimumCanvasSizeCache,
	next: ProjectState,
	before: Element,
	after: Element
) {
	const previous = getElementSize(before);
	const current = getElementSize(after);
	const invalidatedWidth =
		cache.widthHolderId === before.id && current.width < cache.width && previous.width === cache.width;
	const invalidatedHeight =
		cache.heightHolderId === before.id && current.height < cache.height && previous.height === cache.height;

	if (invalidatedWidth || invalidatedHeight) return measureMinimumCanvasSizeCache(next.elements);

	let updated = cache;
	if (current.width >= updated.width) updated = { ...updated, width: current.width, widthHolderId: after.id };
	if (current.height >= updated.height) updated = { ...updated, height: current.height, heightHolderId: after.id };
	return updated;
}

function trackDeletedElementsMinimumCanvasSize(
	cache: MinimumCanvasSizeCache,
	next: ProjectState,
	ids: readonly string[]
) {
	const deleted = new Set(ids);
	if (!cache.widthHolderId && !cache.heightHolderId) return cache;
	if (!deleted.has(cache.widthHolderId ?? "") && !deleted.has(cache.heightHolderId ?? "")) return cache;
	return measureMinimumCanvasSizeCache(next.elements);
}

const projectStore = writable<ProjectState>(initialProjectState);
const minimumCanvasSizeStore = writable<MinimumCanvasSize>({ width: 1, height: 1 });
const documentRevisionStore = writable(0);
const indexedDocument = createIndexedDocument(initialProjectState.elements);

let currentProjectState = initialProjectState;
let currentMinimumCanvasSizeCache = measureMinimumCanvasSizeCache(initialProjectState.elements);
let currentDocumentRevision = 0;
let applyingIndexedMutation = false;

function applyMinimumCanvasSizeHint(
	cache: MinimumCanvasSizeCache,
	prev: ProjectState,
	next: ProjectState,
	hint: MinimumCanvasSizeHint
) {
	if (hint === "preserve") return preserveMinimumCanvasSizeCache(cache);
	if (hint === "rescan") return rescanMinimumCanvasSizeCache(cache, prev, next);
	if ("added" in hint) return trackAddedElementsMinimumCanvasSize(cache, hint.added);
	if ("changed" in hint)
		return trackChangedElementMinimumCanvasSize(cache, next, hint.changed.before, hint.changed.after);
	return trackDeletedElementsMinimumCanvasSize(cache, next, hint.deleted);
}

function applyProjectState(next: ProjectState, hint: MinimumCanvasSizeHint): boolean {
	if (isEditorMutationBlocked()) return false;
	currentMinimumCanvasSizeCache = applyMinimumCanvasSizeHint(
		currentMinimumCanvasSizeCache,
		currentProjectState,
		next,
		hint
	);
	const elementsChanged = next.elements !== currentProjectState.elements;
	currentProjectState = next;
	if (elementsChanged && !applyingIndexedMutation) indexedDocument.replace(next.elements);
	currentDocumentRevision += 1;
	documentRevisionStore.set(currentDocumentRevision);
	recordDocumentRevision();
	minimumCanvasSizeStore.set(toMinimumCanvasSize(currentMinimumCanvasSizeCache));
	recordChangePublication();
	projectStore.set(next);
	return true;
}

/** The editor's live project and selection state. */
export const projectState = {
	subscribe: projectStore.subscribe
} as const;

/** Read-only access to the editor-owned indexed document seam. */
export const documentIndex = {
	size: indexedDocument.size,
	revision: indexedDocument.revision,
	has: indexedDocument.has,
	get: indexedDocument.get,
	ordered: indexedDocument.ordered,
	snapshot: indexedDocument.snapshot,
	subscribe: indexedDocument.subscribe
} as const;

/** The document revision, independent from interaction revisions. */
export const documentRevisionState = {
	subscribe: documentRevisionStore.subscribe
} as const;

/** Applies a project-state transition with an explicit minimum-canvas-size cache strategy. */
export function updateProjectState(
	updater: (state: ProjectState) => ProjectState,
	hint: MinimumCanvasSizeHint
): boolean {
	if (isEditorMutationBlocked()) return false;
	return applyProjectState(updater(currentProjectState), hint);
}

function hintForDocumentChange(change: DocumentChangeSet): MinimumCanvasSizeHint {
	if (change.tag === "add") {
		return { added: change.changes.flatMap((entry) => (entry.after ? [entry.after] : [])) };
	}
	if (change.tag === "delete") return { deleted: change.changes.map((entry) => entry.id) };
	if (change.tag === "update" && change.changes.length === 1) {
		const entry = change.changes[0];
		if (entry?.before && entry.after) return { changed: { before: entry.before, after: entry.after } };
	}
	return "preserve";
}

/** Applies one indexed document command and publishes its compatibility projection. */
export function updateIndexedProject(
	mutation: (document: IndexedDocument) => DocumentChangeSet | null,
	hint?: MinimumCanvasSizeHint
): DocumentChangeSet | null {
	if (isEditorMutationBlocked()) return null;
	const change = mutation(indexedDocument);
	if (!change) return null;

	applyingIndexedMutation = true;
	try {
		applyProjectState(
			{ ...currentProjectState, elements: indexedDocument.snapshot() },
			hint ?? hintForDocumentChange(change)
		);
	} finally {
		applyingIndexedMutation = false;
	}
	return change;
}

/** Sets the complete project state with an explicit minimum-canvas-size cache strategy. */
export function setProjectState(next: ProjectState, hint: MinimumCanvasSizeHint): boolean {
	return applyProjectState(next, hint);
}

/** The smallest canvas size that can contain the current largest element dimensions. */
export const minimumCanvasSizeState = {
	subscribe: minimumCanvasSizeStore.subscribe
} as const;
