import type { Element } from "@maply/model/types";
import { derived, writable } from "svelte/store";

import { getMinimumCanvasSize } from "../elements/geometry";
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

/** The smallest canvas size that can contain the current largest element dimensions. */
export const minimumCanvasSizeState = derived(projectState, ($project) => getMinimumCanvasSize($project.elements));

/** The default fill used by newly created fillable elements. */
export const fillState = writable("#e5e5e5");

/** The in-memory editor clipboard. Its contents are never persisted. */
export const clipboardState = writable<Element[]>([]);
