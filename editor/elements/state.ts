import { updateProjectState } from "../state/document";

function toIdSet(ids: string | readonly string[]): Set<string> {
	return new Set(typeof ids === "string" ? [ids] : ids);
}

/** Sets the locked state for one or more existing elements. */
export function setLocked(ids: string | readonly string[], locked: boolean): void {
	const idSet = toIdSet(ids);

	updateProjectState(
		(state) => ({
			...state,
			elements: state.elements.map((element) => (idSet.has(element.id) ? { ...element, locked } : element))
		}),
		"preserve"
	);
}

/** Sets the bindable state for one or more existing elements. */
export function setBindable(ids: string | readonly string[], bindable: boolean): void {
	const idSet = toIdSet(ids);

	updateProjectState(
		(state) => ({
			...state,
			elements: state.elements.map((element) => (idSet.has(element.id) ? { ...element, bindable } : element))
		}),
		"preserve"
	);
}

/** Sets visibility and clears editor interaction state for elements that become hidden. */
export function setVisible(ids: string | readonly string[], visible: boolean): void {
	const idSet = toIdSet(ids);

	updateProjectState((state) => {
		const hiddenIds = visible
			? new Set<string>()
			: new Set(state.elements.filter((element) => idSet.has(element.id)).map((element) => element.id));
		const selectedElementIds = state.selectedElementIds.filter((id) => !hiddenIds.has(id));

		return {
			...state,
			elements: state.elements.map((element) => (idSet.has(element.id) ? { ...element, visible } : element)),
			selectedElementIds,
			selectedElementId: selectedElementIds.at(-1) ?? null,
			hoveredElementId: hiddenIds.has(state.hoveredElementId ?? "") ? null : state.hoveredElementId,
			cropEditingElementId: hiddenIds.has(state.cropEditingElementId ?? "") ? null : state.cropEditingElementId
		};
	}, "preserve");
}
