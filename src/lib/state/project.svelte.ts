import { fetchProject, PROD_PROJECT_ID, resetProdProject, saveProject } from "$lib/storage/project";
import type { Element, Project } from "$lib/storage/schema";

import { canvasState } from "./canvas.svelte";

function defaultElementName(element: Element): string {
	switch (element.type) {
		case "rect":
			return "rectangle";
		case "circle":
			return "circle";
		case "path":
			return "path";
		case "text":
			return "text";
		case "image":
			return "image";
		default:
			return "element";
	}
}

function normalizeElements(items: Element[]): Element[] {
	return items.map((element) => {
		const normalized: Element = {
			...element,
			name: element.name?.trim() || defaultElementName(element)
		};

		if (normalized.type === "path" && (typeof normalized.x !== "number" || typeof normalized.y !== "number")) {
			normalized.x = 0;
			normalized.y = 0;
		}

		return normalized;
	});
}

function createProjectState() {
	let id = $state(PROD_PROJECT_ID);
	let name = $state("Untitled");
	let elements = $state<Project["elements"]>([]);
	let importExportState = $state<Project["importExportState"]>({
		importsOpen: true,
		elementsOpen: true
	});
	let initialized = $state(false);
	let saveTimeout: ReturnType<typeof setTimeout> | null = null;
	let selectedElementId = $state<string | null>(null);

	function toProject(): Project {
		return {
			id,
			name,
			canvas: {
				width: canvasState.width,
				height: canvasState.height,
				x: canvasState.x,
				y: canvasState.y
			},
			camera: {
				x: canvasState.camera.x,
				y: canvasState.camera.y,
				zoom: canvasState.camera.zoom
			},
			elements: elements.map((element) => ({ ...element })),
			importExportState: { ...importExportState }
		};
	}

	function queueSave(project = toProject()) {
		if (!initialized) return;
		if (saveTimeout) clearTimeout(saveTimeout);

		saveTimeout = setTimeout(() => {
			saveProject(project).catch((error) => {
				console.warn("Failed to save project:", error);
			});
		}, 500);
	}

	async function saveNow() {
		if (!initialized) return;
		if (saveTimeout) clearTimeout(saveTimeout);

		try {
			await saveProject(toProject());
		} catch (error) {
			console.warn("Failed to save project:", error);
		}
	}

	async function load(projectId = PROD_PROJECT_ID) {
		id = projectId;

		try {
			const record = await fetchProject(id);
			name = record.name;
			elements = normalizeElements(record.elements);
			importExportState = record.importExportState;
			canvasState.setSize(record.canvas.width, record.canvas.height);
			canvasState.setPosition(record.canvas.x, record.canvas.y);
			if (record.camera) {
				canvasState.setCamera(record.camera);
			}
		} catch (error) {
			console.warn("Failed to load project, using defaults:", error);
		}

		selectedElementId = null;
		initialized = true;
	}

	function setName(nextName: string) {
		name = nextName;
		queueSave();
	}

	function setImportExportState(nextState: Partial<Project["importExportState"]>) {
		const nextImportExportState = {
			...importExportState,
			...nextState
		};

		if (
			nextImportExportState.importsOpen === importExportState.importsOpen &&
			nextImportExportState.elementsOpen === importExportState.elementsOpen
		) {
			return;
		}

		importExportState = nextImportExportState;
		queueSave();
	}

	async function createNewProject() {
		const fresh = await resetProdProject();
		name = fresh.name;
		elements = fresh.elements;
		importExportState = fresh.importExportState;
		selectedElementId = null;
		canvasState.setSize(fresh.canvas.width, fresh.canvas.height);
		canvasState.setPosition(fresh.canvas.x, fresh.canvas.y);
		if (fresh.camera) {
			canvasState.setCamera(fresh.camera);
		} else {
			canvasState.resetCamera();
		}
		queueSave();
	}

	function addElement(element: Element) {
		elements = [...elements, element];
		selectedElementId = element.id;
		queueSave();
	}

	function updateElement(id: string, patch: Partial<Omit<Element, "id" | "type">>) {
		elements = elements.map((element) => {
			if (element.id !== id) return element;
			return { ...element, ...patch } as Element;
		});
		queueSave();
	}

	function renameElement(id: string, nextName: string) {
		updateElement(id, { name: nextName });
	}

	function selectElement(id: string | null) {
		selectedElementId = id;
	}

	function reorderElements(fromIndex: number, toIndex: number) {
		if (
			fromIndex === toIndex ||
			fromIndex < 0 ||
			fromIndex >= elements.length ||
			toIndex < 0 ||
			toIndex >= elements.length
		) {
			return;
		}

		const next = [...elements];
		const [moved] = next.splice(fromIndex, 1);
		next.splice(toIndex, 0, moved);
		elements = next;
		queueSave();
	}

	function deleteElement(id: string) {
		elements = elements.filter((element) => element.id !== id);
		if (selectedElementId === id) {
			selectedElementId = null;
		}
		queueSave();
	}

	return {
		get id() {
			return id;
		},
		get name() {
			return name;
		},
		get initialized() {
			return initialized;
		},
		get importExportState() {
			return importExportState;
		},
		get elements() {
			return elements;
		},
		get selectedElementId() {
			return selectedElementId;
		},
		get selectedElement() {
			return elements.find((element) => element.id === selectedElementId) ?? null;
		},
		load,
		queueSave,
		saveNow,
		setName,
		setImportExportState,
		createNewProject,
		addElement,
		updateElement,
		renameElement,
		selectElement,
		reorderElements,
		deleteElement
	};
}

export const projectState = createProjectState();
export type { Project };
