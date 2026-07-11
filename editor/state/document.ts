import { writable } from "svelte/store";

import type { ProjectState } from "../types";

const initialProjectState: ProjectState = {
	id: "prod",
	name: "Untitled",
	elements: [],
	initialized: false,
	selectedElementId: null,
	selectedElementIds: [],
	hoveredElementId: null,
	cropEditingElementId: null
};

/** The editor's live project and selection state. */
export const projectState = writable<ProjectState>(initialProjectState);

/** The default fill used by newly created fillable elements. */
export const fillState = writable("#e5e5e5");
