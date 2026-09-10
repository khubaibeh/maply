import { get } from "svelte/store";

import { projectState } from "../state/document";
import { updateInteractionState } from "../state/interaction";

function selection(ids: readonly string[]) {
	const selectedElementIds = [...new Set(ids)];
	return { selectedElementIds, selectedElementId: selectedElementIds.at(-1) ?? null };
}

/** Selects an element, optionally toggling it into the current selection. */
export function select(id: string | null, additive = false): void {
	updateInteractionState((state) => {
		if (id === null) {
			return { ...state, ...selection([]), hoveredElementId: null, cropEditingElementId: null };
		}

		if (!additive) {
			return {
				...state,
				...selection([id]),
				hoveredElementId: null,
				cropEditingElementId: state.cropEditingElementId === id ? id : null
			};
		}

		let ids = [...state.selectedElementIds, id];
		if (state.selectedElementIds.includes(id)) {
			ids = state.selectedElementIds.filter((selected) => selected !== id);
		}

		const next = selection(ids);

		let cropEditingElementId = null;
		if (state.cropEditingElementId && next.selectedElementIds.includes(state.cropEditingElementId)) {
			cropEditingElementId = state.cropEditingElementId;
		}

		return {
			...state,
			...next,
			hoveredElementId: null,
			cropEditingElementId
		};
	});
}

/** Replaces the current selection with the supplied element IDs. */
export function selectMany(ids: readonly string[]): void {
	updateInteractionState((state) => {
		const next = selection(ids);
		return {
			...state,
			...next,
			hoveredElementId: null,
			cropEditingElementId:
				state.cropEditingElementId && next.selectedElementIds.includes(state.cropEditingElementId)
					? state.cropEditingElementId
					: null
		};
	});
}

/** Selects every current element. */
export function selectAll(): void {
	const ids = get(projectState).elements.map((element) => element.id);
	updateInteractionState((state) => ({ ...state, ...selection(ids), hoveredElementId: null }));
}

/** Updates the currently hovered element. */
export function setHover(id: string | null): void {
	updateInteractionState((state) => {
		return state.hoveredElementId === id ? state : { ...state, hoveredElementId: id };
	});
}

/** Toggles crop editing for a selected image element. */
export function toggleCrop(id: string): void {
	updateInteractionState((state) => {
		const cropEditingElementId = state.cropEditingElementId === id ? null : id;

		return { ...state, ...selection([id]), cropEditingElementId };
	});
}
