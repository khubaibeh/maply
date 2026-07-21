import { updateProjectState } from "../state/document";
import type { ProjectState, SelectionOrder } from "../types";

function reorderInState(state: ProjectState, from: number, to: number): ProjectState {
	if (from === to || from < 0 || to < 0 || from >= state.elements.length || to >= state.elements.length) return state;

	const next = [...state.elements];
	const [element] = next.splice(from, 1);
	next.splice(to, 0, element);

	return { ...state, elements: next };
}

/** Returns paint order after moving selected elements together in the requested direction. */
export function reorderSelection<T extends { id: string }>(
	elements: readonly T[],
	ids: readonly string[],
	direction: SelectionOrder
): T[] {
	const selectedIds = new Set(ids);
	if (!elements.some((element) => selectedIds.has(element.id))) return [...elements];

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
export function canReorderSelection<T extends { id: string }>(
	elements: readonly T[],
	ids: readonly string[],
	direction: SelectionOrder
): boolean {
	const next = reorderSelection(elements, ids, direction);
	return next.some((element, index) => element !== elements[index]);
}

function reorderSelectionInState(state: ProjectState, ids: readonly string[], direction: SelectionOrder): ProjectState {
	const elements = reorderSelection(state.elements, ids, direction);
	return elements.some((element, index) => element !== state.elements[index]) ? { ...state, elements } : state;
}

/** Moves an element between two valid paint-order indices. */
export function reorder(from: number, to: number): void {
	updateProjectState((state) => reorderInState(state, from, to), "preserve");
}

/** Moves selected elements to the front of paint order, preserving their relative order. */
export function moveToFront(ids: readonly string[]): void {
	updateProjectState((state) => reorderSelectionInState(state, ids, "front"), "preserve");
}

/** Moves selected elements one unselected layer toward the front. */
export function moveForward(ids: readonly string[]): void {
	updateProjectState((state) => reorderSelectionInState(state, ids, "forward"), "preserve");
}

/** Moves selected elements one unselected layer toward the back. */
export function moveBackward(ids: readonly string[]): void {
	updateProjectState((state) => reorderSelectionInState(state, ids, "backward"), "preserve");
}

/** Moves selected elements to the back of paint order, preserving their relative order. */
export function moveToBack(ids: readonly string[]): void {
	updateProjectState((state) => reorderSelectionInState(state, ids, "back"), "preserve");
}
