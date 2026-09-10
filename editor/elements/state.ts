import { updateProjectState } from "../state/document";
import { updateInteractionState } from "../state/interaction";

function toIdSet(ids: string | readonly string[]): Set<string> {
	return new Set(typeof ids === "string" ? [ids] : ids);
}

/** Sets the locked state for one or more existing elements and ends their canvas interactions. */
export function setLocked(ids: string | readonly string[], locked: boolean): void {
	const idSet = toIdSet(ids);

	updateProjectState(
		(state) => ({
			...state,
			elements: state.elements.map((element) => (idSet.has(element.id) ? { ...element, locked } : element))
		}),
		"preserve"
	);
	if (locked) {
		updateInteractionState((state) => ({
			...state,
			hoveredElementId: idSet.has(state.hoveredElementId ?? "") ? null : state.hoveredElementId,
			cropEditingElementId: idSet.has(state.cropEditingElementId ?? "") ? null : state.cropEditingElementId
		}));
	}
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

/** Sets visibility and clears hover or crop state for elements that become hidden. */
export function setVisible(ids: string | readonly string[], visible: boolean): void {
	const idSet = toIdSet(ids);

	const hiddenIds = visible ? new Set<string>() : idSet;
	updateProjectState(
		(state) => ({
			...state,
			elements: state.elements.map((element) => (idSet.has(element.id) ? { ...element, visible } : element))
		}),
		"preserve"
	);
	if (!visible) {
		updateInteractionState((state) => ({
			...state,
			hoveredElementId: hiddenIds.has(state.hoveredElementId ?? "") ? null : state.hoveredElementId,
			cropEditingElementId: hiddenIds.has(state.cropEditingElementId ?? "") ? null : state.cropEditingElementId
		}));
	}
}
