import { updateProjectState } from "../state/document";

function selection(ids: readonly string[]) {
	const selectedElementIds = [...new Set(ids)];
	return { selectedElementIds, selectedElementId: selectedElementIds.at(-1) ?? null };
}

/** Selects an element, optionally toggling it into the current selection. */
export function select(id: string | null, additive = false): void {
	updateProjectState((state) => {
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
	}, "preserve");
}

/** Selects every current element. */
export function selectAll(): void {
	updateProjectState(
		(state) => ({
			...state,
			...selection(state.elements.map((element) => element.id)),
			hoveredElementId: null
		}),
		"preserve"
	);
}

/** Updates the currently hovered element. */
export function setHover(id: string | null): void {
	updateProjectState((state) => {
		return state.hoveredElementId === id ? state : { ...state, hoveredElementId: id };
	}, "preserve");
}

/** Toggles crop editing for a selected image element. */
export function toggleCrop(id: string): void {
	updateProjectState((state) => {
		const cropEditingElementId = state.cropEditingElementId === id ? null : id;

		return { ...state, ...selection([id]), cropEditingElementId };
	}, "preserve");
}
