import { get, writable } from "svelte/store";

import { fetchProject, DEFAULTS, resetProdProject } from "../core/db";
import {
	clampElementToCanvas,
	normalizeElements,
	setElementPosition,
	translateElementWithinCanvas
} from "../core/element-actions";
import type { Element } from "../domain/elements";
import type { Project } from "../domain/project";
import { queueProjectSave, saveProjectNow } from "./autosave.svelte";
import { canvasState } from "./canvas.svelte";

// Project state owns document data while canvasState owns viewport and artboard geometry.
type ProjectState = {
	id: string;
	name: string;
	elements: Project["elements"];
	importExportState: Project["importExportState"];
	initialized: boolean;
	selectedElementId: string | null;
};

const store = writable<ProjectState>({
	id: DEFAULTS.prodProjId,
	name: "Untitled",
	elements: [],
	importExportState: {
		importsOpen: true,
		elementsOpen: true
	},
	initialized: false,
	selectedElementId: null
});

function toProject(): Project {
	// Persisted projects are assembled from both state stores.
	const project = get(store);
	const canvas = canvasState.getSnapshot();

	return {
		id: project.id,
		name: project.name,
		canvas: {
			width: canvas.width,
			height: canvas.height,
			x: canvas.x,
			y: canvas.y
		},
		camera: {
			x: canvas.camera.x,
			y: canvas.camera.y,
			zoom: canvas.camera.zoom
		},
		elements: project.elements.map((element) => ({ ...element })),
		importExportState: { ...project.importExportState }
	};
}

export const projectState = {
	subscribe: store.subscribe,

	toProject,

	getSelectedElement() {
		const project = get(store);
		return project.elements.find((element) => element.id === project.selectedElementId) ?? null;
	},

	queueSave(project = toProject()) {
		queueProjectSave(project, get(store).initialized);
	},

	async saveNow() {
		await saveProjectNow(toProject(), get(store).initialized);
	},

	async load(projectId = DEFAULTS.prodProjId) {
		store.update((state) => ({ ...state, id: projectId }));

		try {
			const record = await fetchProject(projectId);
			// Canvas is hydrated first so loaded elements can be normalized against current bounds.
			canvasState.setSize(record.canvas.width, record.canvas.height);
			canvasState.setPosition(record.canvas.x, record.canvas.y);
			if (record.camera) {
				canvasState.setCamera(record.camera);
			}

			const canvas = canvasState.getSnapshot();
			store.update((state) => ({
				...state,
				name: record.name,
				elements: normalizeElements(record.elements).map((element) => clampElementToCanvas(element, canvas)),
				importExportState: record.importExportState
			}));
		} catch (error) {
			console.warn("Failed to load project, using defaults:", error);
		}

		// Autosave is enabled only after the initial load path has finished.
		store.update((state) => ({ ...state, selectedElementId: null, initialized: true }));
	},

	setName(nextName: string) {
		store.update((state) => ({ ...state, name: nextName }));
		this.queueSave();
	},

	setImportExportState(nextState: Partial<Project["importExportState"]>) {
		const current = get(store).importExportState;
		const nextImportExportState = {
			...current,
			...nextState
		};

		if (
			nextImportExportState.importsOpen === current.importsOpen &&
			nextImportExportState.elementsOpen === current.elementsOpen
		) {
			return;
		}

		store.update((state) => ({ ...state, importExportState: nextImportExportState }));
		this.queueSave();
	},

	async createNewProject() {
		// The app has one editable project slot, so creating a project resets that slot.
		const fresh = await resetProdProject();
		canvasState.setSize(fresh.canvas.width, fresh.canvas.height);
		canvasState.setPosition(fresh.canvas.x, fresh.canvas.y);
		if (fresh.camera) {
			canvasState.setCamera(fresh.camera);
		} else {
			canvasState.resetCamera();
		}

		const canvas = canvasState.getSnapshot();
		store.update((state) => ({
			...state,
			name: fresh.name,
			elements: fresh.elements.map((element) => clampElementToCanvas(element, canvas)),
			importExportState: fresh.importExportState,
			selectedElementId: null
		}));
		this.queueSave();
	},

	addElement(element: Element) {
		const canvas = canvasState.getSnapshot();
		const nextElement = clampElementToCanvas(element, canvas);

		store.update((state) => ({
			...state,
			elements: [...state.elements, nextElement],
			selectedElementId: nextElement.id
		}));
		this.queueSave();
	},

	updateElement(id: string, patch: Partial<Omit<Element, "id" | "type">>) {
		const canvas = canvasState.getSnapshot();

		store.update((state) => ({
			...state,
			elements: state.elements.map((element) => {
				if (element.id !== id) return element;
				return clampElementToCanvas({ ...element, ...patch } as Element, canvas);
			})
		}));
		this.queueSave();
	},

	translateElement(id: string, dx: number, dy: number) {
		if (dx === 0 && dy === 0) return;
		const canvas = canvasState.getSnapshot();

		store.update((state) => ({
			...state,
			elements: state.elements.map((element) => {
				if (element.id !== id) return element;
				return translateElementWithinCanvas(element, dx, dy, canvas);
			})
		}));
		this.queueSave();
	},

	setElementPosition(id: string, x: number, y: number) {
		const canvas = canvasState.getSnapshot();

		store.update((state) => ({
			...state,
			elements: state.elements.map((element) => {
				if (element.id !== id) return element;
				return setElementPosition(element, x, y, canvas);
			})
		}));
		this.queueSave();
	},

	clampElementsToCanvas() {
		const canvas = canvasState.getSnapshot();

		store.update((state) => ({
			...state,
			elements: state.elements.map((element) => clampElementToCanvas(element, canvas))
		}));
		this.queueSave();
	},

	renameElement(id: string, nextName: string) {
		this.updateElement(id, { name: nextName });
	},

	selectElement(id: string | null) {
		store.update((state) => ({ ...state, selectedElementId: id }));
	},

	reorderElements(fromIndex: number, toIndex: number) {
		const project = get(store);
		if (
			fromIndex === toIndex ||
			fromIndex < 0 ||
			fromIndex >= project.elements.length ||
			toIndex < 0 ||
			toIndex >= project.elements.length
		) {
			return;
		}

		const next = [...project.elements];
		const [moved] = next.splice(fromIndex, 1);
		next.splice(toIndex, 0, moved);
		store.update((state) => ({ ...state, elements: next }));
		this.queueSave();
	},

	deleteElement(id: string) {
		store.update((state) => ({
			...state,
			elements: state.elements.filter((element) => element.id !== id),
			selectedElementId: state.selectedElementId === id ? null : state.selectedElementId
		}));
		this.queueSave();
	}
};

export type { Project };
