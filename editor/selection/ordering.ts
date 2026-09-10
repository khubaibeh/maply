import { documentIndex, updateIndexedProject } from "../state/document";
import type { SelectionOrder } from "../types";

/** Returns paint order after moving selected elements together in the requested direction. */
export function reorderSelection<T extends { id: string; locked?: boolean }>(
	elements: readonly T[],
	ids: readonly string[],
	direction: SelectionOrder
): T[] {
	const selectedIds = new Set(ids);
	if (!elements.some((element) => selectedIds.has(element.id))) return [...elements];
	if (elements.some((element) => selectedIds.has(element.id) && element.locked)) return [...elements];

	if (direction === "front") {
		return [
			...elements.filter((element) => !selectedIds.has(element.id)),
			...elements.filter((element) => selectedIds.has(element.id))
		];
	}
	if (direction === "back") {
		return [
			...elements.filter((element) => selectedIds.has(element.id)),
			...elements.filter((element) => !selectedIds.has(element.id))
		];
	}

	const next = [...elements];
	if (direction === "forward") {
		for (let index = next.length - 2; index >= 0; index -= 1) {
			if (selectedIds.has(next[index].id) && !selectedIds.has(next[index + 1].id)) {
				[next[index], next[index + 1]] = [next[index + 1], next[index]];
			}
		}
	} else {
		for (let index = 1; index < next.length; index += 1) {
			if (selectedIds.has(next[index].id) && !selectedIds.has(next[index - 1].id)) {
				[next[index], next[index - 1]] = [next[index - 1], next[index]];
			}
		}
	}

	return next;
}

/** Returns whether a selected set has at least one valid move in the requested direction. */
export function canReorderSelection<T extends { id: string; locked?: boolean }>(
	elements: readonly T[],
	ids: readonly string[],
	direction: SelectionOrder
): boolean {
	const next = reorderSelection(elements, ids, direction);
	return next.some((element, index) => element !== elements[index]);
}

function reorderToResult(ids: readonly string[], direction: SelectionOrder): void {
	const elements = documentIndex.snapshot();
	const next = reorderSelection(elements, ids, direction);
	const firstSelectedIndex = next.findIndex((element) => ids.includes(element.id));
	if (firstSelectedIndex < 0) return;
	const toIndex = next.slice(0, firstSelectedIndex).filter((element) => !ids.includes(element.id)).length;
	updateIndexedProject((document) => document.reorder(ids, toIndex), "preserve");
}

/** Moves an element between two valid paint-order indices. */
export function reorder(from: number, to: number): void {
	const elements = documentIndex.snapshot();
	const element = elements[from];
	if (!element || from === to || from < 0 || to < 0 || to >= elements.length || element.locked) return;
	updateIndexedProject((document) => document.reorder([element.id], to), "preserve");
}

/** Moves selected elements to the front of paint order, preserving their relative order. */
export function moveToFront(ids: readonly string[]): void {
	reorderToResult(ids, "front");
}

/** Moves selected elements one unselected layer toward the front. */
export function moveForward(ids: readonly string[]): void {
	reorderToResult(ids, "forward");
}

/** Moves selected elements one unselected layer toward the back. */
export function moveBackward(ids: readonly string[]): void {
	reorderToResult(ids, "backward");
}

/** Moves selected elements to the back of paint order, preserving their relative order. */
export function moveToBack(ids: readonly string[]): void {
	reorderToResult(ids, "back");
}
