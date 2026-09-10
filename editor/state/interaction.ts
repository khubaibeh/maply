import { writable } from "svelte/store";

import type { InteractionState } from "../types";
import { isEditorMutationBlocked } from "./editing";

const initialInteractionState: InteractionState = {
	selectedElementId: null,
	selectedElementIds: [],
	hoveredElementId: null,
	cropEditingElementId: null
};

const interactionStore = writable<InteractionState>(initialInteractionState);
const interactionRevisionStore = writable(0);

let currentInteractionState = initialInteractionState;
let currentInteractionRevision = 0;

function sameInteractionState(left: InteractionState, right: InteractionState): boolean {
	return (
		left.selectedElementId === right.selectedElementId &&
		left.hoveredElementId === right.hoveredElementId &&
		left.cropEditingElementId === right.cropEditingElementId &&
		left.selectedElementIds.length === right.selectedElementIds.length &&
		left.selectedElementIds.every((id, index) => id === right.selectedElementIds[index])
	);
}

function applyInteractionState(next: InteractionState): boolean {
	if (isEditorMutationBlocked() || sameInteractionState(currentInteractionState, next)) return false;
	currentInteractionState = next;
	currentInteractionRevision += 1;
	interactionRevisionStore.set(currentInteractionRevision);
	interactionStore.set(next);
	return true;
}

/** The live non-persistent interaction state. */
export const interactionState = {
	subscribe: interactionStore.subscribe
} as const;

/** The interaction revision, independent from document revisions. */
export const interactionRevisionState = {
	subscribe: interactionRevisionStore.subscribe
} as const;

/** Returns the current interaction state for command composition. */
export function getInteractionState(): InteractionState {
	return currentInteractionState;
}

/** Applies one transient interaction-state transition. */
export function updateInteractionState(updater: (state: InteractionState) => InteractionState): boolean {
	if (isEditorMutationBlocked()) return false;
	return applyInteractionState(updater(currentInteractionState));
}

/** Restores transient state at a cold project boundary. */
export function resetInteractionState(): void {
	currentInteractionState = initialInteractionState;
	currentInteractionRevision += 1;
	interactionRevisionStore.set(currentInteractionRevision);
	interactionStore.set(initialInteractionState);
}
