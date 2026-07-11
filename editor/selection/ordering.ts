import { projectState } from "../state/document";
import type { ProjectState } from "../types";

function reorderInState(state: ProjectState, from: number, to: number): ProjectState {
	if (from === to || from < 0 || to < 0 || from >= state.elements.length || to >= state.elements.length) return state;

	const next = [...state.elements];
	const [element] = next.splice(from, 1);
	next.splice(to, 0, element);

	return { ...state, elements: next };
}

/** Moves an element between two valid paint-order indices. */
export function reorder(from: number, to: number): void {
	projectState.update((state) => reorderInState(state, from, to));
}

/** Moves an element to the front of paint order. */
export function moveToFront(id: string): void {
	projectState.update((state) => {
		const from = state.elements.findIndex((element) => element.id === id);
		if (from === -1) return state;
		return reorderInState(state, from, state.elements.length - 1);
	});
}

/** Moves an element one step toward the front of paint order. */
export function moveForward(id: string): void {
	projectState.update((state) => {
		const from = state.elements.findIndex((element) => element.id === id);
		if (from === -1) return state;
		return reorderInState(state, from, from + 1);
	});
}

/** Moves an element one step toward the back of paint order. */
export function moveBackward(id: string): void {
	projectState.update((state) => {
		const from = state.elements.findIndex((element) => element.id === id);
		if (from === -1) return state;
		return reorderInState(state, from, from - 1);
	});
}

/** Moves an element to the back of paint order. */
export function moveToBack(id: string): void {
	projectState.update((state) => {
		const from = state.elements.findIndex((element) => element.id === id);
		if (from === -1) return state;
		return reorderInState(state, from, 0);
	});
}
