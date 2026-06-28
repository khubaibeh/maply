import {
	deleteImageAsset,
	fetchProject,
	DEFAULTS,
	replaceProject,
	resetProdProject,
	saveImageAsset
} from "$lib/app/core/db";
import { createProjectFilePackage, type ProjectFilePackage, toImportedProject } from "$lib/app/core/project-io";
import { exportProjectSvg } from "$lib/app/core/svg-export";
import { get, writable } from "svelte/store";

import type { Element } from "../domain/elements";
import type { StoredImageAsset } from "../domain/image-assets";
import type { Project } from "../domain/project";
import { queueProjectSave, saveProjectNow } from "../internal/autosave";
import {
	clampElementToCanvas,
	duplicateElement,
	normalizeElements,
	resizeImageFrameWithinCanvas,
	setElementPosition,
	translateElementWithinCanvas
} from "../internal/element";
import type { ResizeHandle } from "../internal/element";
import {
	cloneStoredImageAsset,
	getImageCropStateForFrameResize,
	importImageFile,
	translateImageCrop
} from "../internal/image-assets";
import { appCanvasState } from "./canvas";
import { getClipboardElement } from "./clipboard.svelte";
import { appImageAssetState } from "./image-assets";

type ProjectState = {
	id: string;
	name: string;
	elements: Project["elements"];
	importExportState: Project["importExportState"];
	initialized: boolean;
	selectedElementId: string | null;
	hoveredElementId: string | null;
	cropEditingElementId: string | null;
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
	selectedElementId: null,
	hoveredElementId: null,
	cropEditingElementId: null
});

async function applyProjectRecord(record: Project) {
	appCanvasState.setSize(record.canvas.width, record.canvas.height);
	appCanvasState.setColor(record.canvas.color);
	appCanvasState.setPosition(record.canvas.x, record.canvas.y);
	if (record.camera) {
		appCanvasState.setCamera(record.camera);
	} else {
		appCanvasState.resetCamera();
	}

	const canvas = appCanvasState.getSnapshot();
	store.update((state) => ({
		...state,
		name: record.name,
		elements: normalizeElements(record.elements).map((element) => clampElementToCanvas(element, canvas)),
		importExportState: record.importExportState,
		selectedElementId: null,
		hoveredElementId: null,
		cropEditingElementId: null
	}));
	await appImageAssetState.loadForElements(record.elements);
}

function getReferencedImageAssets(project: Project): StoredImageAsset[] {
	const assets = appImageAssetState.getSnapshot();
	const referencedIds = Array.from(
		new Set(
			project.elements.flatMap((element) =>
				element.type === "image" && element.assetId ? [element.assetId] : []
			)
		)
	);

	return referencedIds.map((assetId) => {
		const asset = assets[assetId];
		if (!asset) {
			throw new Error(`Project export is missing image asset data for assetId ${assetId}.`);
		}

		return asset;
	});
}

function toProject(): Project {
	const project = get(store);
	const canvas = appCanvasState.getSnapshot();

	return {
		id: project.id,
		name: project.name,
		canvas: {
			width: canvas.width,
			height: canvas.height,
			color: canvas.color,
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

export const appProjectState = {
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
			await applyProjectRecord(record);
		} catch (error) {
			console.warn("Failed to load project, using defaults:", error);
			appImageAssetState.clear();
		}

		store.update((state) => ({
			...state,
			selectedElementId: null,
			hoveredElementId: null,
			cropEditingElementId: null,
			initialized: true
		}));
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

	async createNewProject(options: { elements?: "sample" | "blank" } = {}) {
		const fresh = await resetProdProject(options);
		await applyProjectRecord(fresh);
		this.queueSave();
	},

	exportProjectFilePackage(): ProjectFilePackage {
		const project = toProject();
		return createProjectFilePackage(project, getReferencedImageAssets(project));
	},

	async exportSvg() {
		const project = toProject();
		return exportProjectSvg(project, getReferencedImageAssets(project));
	},

	async importProjectFilePackage(projectFile: ProjectFilePackage) {
		const activeProjectId = get(store).id;
		const imported = toImportedProject(projectFile, activeProjectId);
		await replaceProject(imported.project, imported.imageAssets);

		appImageAssetState.setAll(imported.imageAssets);
		await applyProjectRecord(imported.project);
		store.update((state) => ({ ...state, initialized: true }));
	},

	addElement(element: Element) {
		const canvas = appCanvasState.getSnapshot();
		const nextElement = clampElementToCanvas(element, canvas);

		store.update((state) => ({
			...state,
			elements: [...state.elements, nextElement],
			selectedElementId: nextElement.id
		}));
		this.queueSave();
	},

	async setImageAssetFromFile(id: string, file: File) {
		const projectId = get(store).id;
		const nextAsset = await importImageFile(file, projectId);
		await saveImageAsset(nextAsset);
		appImageAssetState.setAsset(nextAsset);

		const current = get(store).elements.find((element) => element.id === id);
		if (current?.type === "image" && current.assetId && current.assetId !== nextAsset.id) {
			await deleteImageAsset(current.assetId);
			appImageAssetState.removeAsset(current.assetId);
		}

		this.updateElement(id, {
			assetId: nextAsset.id,
			href: undefined,
			cropX: 0,
			cropY: 0,
			cropScale: 100
		} as Partial<Element>);
	},

	async clearImageAsset(id: string) {
		const current = get(store).elements.find((element) => element.id === id);
		if (current?.type !== "image") return;

		if (current.assetId) {
			await deleteImageAsset(current.assetId);
			appImageAssetState.removeAsset(current.assetId);
		}

		this.updateElement(id, {
			assetId: null,
			href: "",
			cropX: 0,
			cropY: 0,
			cropScale: 100
		} as Partial<Element>);
	},

	resetImageCrop(id: string) {
		this.updateElement(id, {
			cropX: 0,
			cropY: 0,
			cropScale: 100
		} as Partial<Element>);
	},

	translateImageCrop(id: string, dx: number, dy: number) {
		const current = get(store).elements.find((element) => element.id === id);
		if (!current || current.type !== "image" || !current.assetId) return;

		const asset = appImageAssetState.getAsset(current.assetId);
		if (!asset) return;

		const nextCrop = translateImageCrop(
			{ cropX: current.cropX, cropY: current.cropY, cropScale: current.cropScale },
			dx,
			dy,
			{
				width: current.width,
				height: current.height,
				assetWidth: asset.width,
				assetHeight: asset.height,
				cropScale: current.cropScale
			}
		);

		this.updateElement(id, nextCrop as Partial<Element>);
	},

	setImageCropScale(id: string, cropScale: number) {
		this.updateElement(id, {
			cropScale: Math.max(100, Math.min(800, Math.round(cropScale)))
		} as Partial<Element>);
	},

	resizeImageFrame(id: string, handle: ResizeHandle, dx: number, dy: number) {
		const canvas = appCanvasState.getSnapshot();

		store.update((state) => ({
			...state,
			elements: state.elements.map((element) => {
				if (element.id !== id || element.type !== "image") return element;

				const nextFrame = resizeImageFrameWithinCanvas(element, handle, dx, dy, canvas);
				if (!element.assetId) return nextFrame;

				const asset = appImageAssetState.getAsset(element.assetId);
				if (!asset) return nextFrame;

				const nextCrop = getImageCropStateForFrameResize(
					{ cropX: element.cropX, cropY: element.cropY, cropScale: element.cropScale },
					{
						previousFrame: {
							x: element.x,
							y: element.y,
							width: element.width,
							height: element.height
						},
						nextFrame: {
							x: nextFrame.x,
							y: nextFrame.y,
							width: nextFrame.width,
							height: nextFrame.height
						},
						assetWidth: asset.width,
						assetHeight: asset.height
					}
				);

				return { ...nextFrame, ...nextCrop };
			})
		}));
		this.queueSave();
	},

	updateElement(id: string, patch: Partial<Omit<Element, "id" | "type">>) {
		const canvas = appCanvasState.getSnapshot();

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
		const canvas = appCanvasState.getSnapshot();

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
		const canvas = appCanvasState.getSnapshot();

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
		const canvas = appCanvasState.getSnapshot();

		store.update((state) => ({
			...state,
			elements: state.elements.map((element) => clampElementToCanvas(element, canvas))
		}));
		this.queueSave();
	},

	renameElement(id: string, nextName: string) {
		this.updateElement(id, { name: nextName });
	},

	setCropEditingElement(id: string | null) {
		store.update((state) => ({ ...state, cropEditingElementId: id }));
	},

	setHoveredElement(id: string | null) {
		store.update((state) => (state.hoveredElementId === id ? state : { ...state, hoveredElementId: id }));
	},

	toggleCropEditingElement(id: string) {
		store.update((state) => ({
			...state,
			selectedElementId: id,
			cropEditingElementId: state.cropEditingElementId === id ? null : id
		}));
	},

	async pasteClipboardElement() {
		const copied = getClipboardElement();
		if (!copied) return;

		const nextElement = duplicateElement(copied, get(store).elements);
		if (nextElement.type === "image" && nextElement.assetId) {
			const asset = appImageAssetState.getAsset(nextElement.assetId);
			if (asset) {
				const clonedAsset = cloneStoredImageAsset(asset, get(store).id);
				await saveImageAsset(clonedAsset);
				appImageAssetState.setAsset(clonedAsset);
				nextElement.assetId = clonedAsset.id;
			} else {
				nextElement.assetId = null;
			}
		}

		this.addElement(nextElement);
	},

	selectElement(id: string | null) {
		store.update((state) => ({
			...state,
			selectedElementId: id,
			hoveredElementId: id === null ? state.hoveredElementId : id,
			cropEditingElementId: state.cropEditingElementId === id ? state.cropEditingElementId : null
		}));
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

	moveElementToFront(id: string) {
		const project = get(store);
		const index = project.elements.findIndex((element) => element.id === id);
		this.reorderElements(index, project.elements.length - 1);
	},

	moveElementForward(id: string) {
		const project = get(store);
		const index = project.elements.findIndex((element) => element.id === id);
		this.reorderElements(index, index + 1);
	},

	moveElementBackward(id: string) {
		const project = get(store);
		const index = project.elements.findIndex((element) => element.id === id);
		this.reorderElements(index, index - 1);
	},

	moveElementToBack(id: string) {
		const project = get(store);
		const index = project.elements.findIndex((element) => element.id === id);
		this.reorderElements(index, 0);
	},

	deleteElement(id: string) {
		const current = get(store).elements.find((element) => element.id === id);
		store.update((state) => ({
			...state,
			elements: state.elements.filter((element) => element.id !== id),
			selectedElementId: state.selectedElementId === id ? null : state.selectedElementId,
			cropEditingElementId: state.cropEditingElementId === id ? null : state.cropEditingElementId
		}));
		if (current?.type === "image" && current.assetId) {
			deleteImageAsset(current.assetId).catch((error) => {
				console.warn("Failed to delete image asset:", error);
			});
			appImageAssetState.removeAsset(current.assetId);
		}
		this.queueSave();
	}
};

export type { Project };
