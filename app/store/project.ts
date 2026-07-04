import { get, writable } from "svelte/store";

import type { Element } from "../domain/elements";
import type { Point } from "../domain/geometry";
import type { StoredImageAsset } from "../domain/image-assets";
import type { Project } from "../domain/project";
import {
	deleteImageAsset,
	fetchProject,
	DEFAULTS,
	replaceProject,
	resetProdProject,
	saveImageAsset
} from "../internal/db";
import {
	clampElementToCanvas,
	duplicateElement,
	getElementBounds,
	normalizeElements,
	resizeElementWithinCanvas,
	resizeImageFrameWithinCanvas,
	setElementPosition,
	translateElement,
	translateElementWithinCanvas
} from "../internal/element-actions";
import type { ResizeHandle, ResizeOptions } from "../internal/element-actions";
import {
	cloneStoredImageAsset,
	getImageCropStateForFrameResize,
	importImageFile,
	translateImageCrop
} from "../internal/image-assets";
import { createProjectFilePackage, type ProjectFilePackage, toImportedProject } from "../internal/project-file";
import { exportProjectSvg } from "../internal/svg-export";
import { appCanvasState } from "./canvas";
import { getClipboardElements } from "./clipboard.svelte";
import { appImageAssetState } from "./image-assets";

type ProjectState = {
	id: string;
	name: string;
	elements: Project["elements"];
	importExportState: Project["importExportState"];
	initialized: boolean;
	selectedElementId: string | null;
	selectedElementIds: string[];
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
	selectedElementIds: [],
	hoveredElementId: null,
	cropEditingElementId: null
});

function uniqueIds(ids: string[]) {
	return Array.from(new Set(ids));
}

function nextSelection(ids: string[]) {
	const selectedElementIds = uniqueIds(ids);
	return {
		selectedElementIds,
		selectedElementId: selectedElementIds.at(-1) ?? null
	};
}

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
		selectedElementIds: [],
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

	getSnapshot() {
		return get(store);
	},

	toProject,

	getSelectedElement() {
		const project = get(store);
		return project.elements.find((element) => element.id === project.selectedElementId) ?? null;
	},

	getSelectedElements() {
		const project = get(store);
		return project.elements.filter((element) => project.selectedElementIds.includes(element.id));
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
			selectedElementIds: [],
			hoveredElementId: null,
			cropEditingElementId: null,
			initialized: true
		}));
	},

	setName(nextName: string) {
		store.update((state) => ({ ...state, name: nextName }));
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
	},

	async createNewProject(options: { elements?: "sample" | "blank" } = {}) {
		const fresh = await resetProdProject(options);
		await applyProjectRecord(fresh);
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
			...nextSelection([nextElement.id])
		}));
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
	},

	resizeElement(id: string, handle: ResizeHandle, dx: number, dy: number, options?: ResizeOptions) {
		const canvas = appCanvasState.getSnapshot();

		store.update((state) => ({
			...state,
			elements: state.elements.map((element) => {
				if (element.id !== id) return element;
				return resizeElementWithinCanvas(element, handle, dx, dy, canvas, options);
			})
		}));
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
	},

	translateElements(ids: string[], dx: number, dy: number) {
		if ((dx === 0 && dy === 0) || ids.length === 0) return;

		const idSet = new Set(ids);
		const canvas = appCanvasState.getSnapshot();
		const elements = get(store).elements.filter((element) => idSet.has(element.id));
		if (elements.length === 0) return;

		const bounds = elements.map(getElementBounds);
		const minDx = Math.max(...bounds.map((entry) => canvas.x - entry.x));
		const maxDx = Math.min(...bounds.map((entry) => canvas.x + canvas.width - (entry.x + entry.width)));
		const minDy = Math.max(...bounds.map((entry) => canvas.y - entry.y));
		const maxDy = Math.min(...bounds.map((entry) => canvas.y + canvas.height - (entry.y + entry.height)));
		const clampedDx = Math.round(Math.min(maxDx, Math.max(minDx, dx)));
		const clampedDy = Math.round(Math.min(maxDy, Math.max(minDy, dy)));
		if (clampedDx === 0 && clampedDy === 0) return;

		store.update((state) => ({
			...state,
			elements: state.elements.map((element) =>
				idSet.has(element.id) ? translateElement(element, clampedDx, clampedDy) : element
			)
		}));
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
	},

	clampElementsToCanvas() {
		const canvas = appCanvasState.getSnapshot();

		store.update((state) => ({
			...state,
			elements: state.elements.map((element) => clampElementToCanvas(element, canvas))
		}));
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
			...nextSelection([id]),
			cropEditingElementId: state.cropEditingElementId === id ? null : id
		}));
	},

	async pasteClipboardElement(point?: Point) {
		const copied = getClipboardElements();
		if (copied.length === 0) return;

		const canvas = appCanvasState.getSnapshot();
		const project = get(store);
		const nextElements = [...project.elements];
		const pasted: Element[] = [];

		for (const copiedElement of copied) {
			const nextElement = duplicateElement(copiedElement, nextElements);
			if (nextElement.type === "image" && nextElement.assetId) {
				const asset = appImageAssetState.getAsset(nextElement.assetId);
				if (asset) {
					const clonedAsset = cloneStoredImageAsset(asset, project.id);
					await saveImageAsset(clonedAsset);
					appImageAssetState.setAsset(clonedAsset);
					nextElement.assetId = clonedAsset.id;
				} else {
					nextElement.assetId = null;
				}
			}

			nextElements.push(nextElement);
			pasted.push(nextElement);
		}

		const positioned =
			point && pasted.length > 0
				? (() => {
						const bounds = pasted.map(getElementBounds);
						const minX = Math.min(...bounds.map((entry) => entry.x));
						const minY = Math.min(...bounds.map((entry) => entry.y));
						const dx = point.x - minX;
						const dy = point.y - minY;
						return pasted.map((element) => clampElementToCanvas(translateElement(element, dx, dy), canvas));
					})()
				: pasted;

		store.update((state) => ({
			...state,
			elements: [...state.elements, ...positioned],
			...nextSelection(positioned.map((element) => element.id))
		}));
	},

	selectElement(id: string | null, options: { additive?: boolean } = {}) {
		store.update((state) => {
			const next =
				id === null
					? nextSelection([])
					: options.additive
						? state.selectedElementIds.includes(id)
							? nextSelection(state.selectedElementIds.filter((selectedId) => selectedId !== id))
							: nextSelection([...state.selectedElementIds, id])
						: nextSelection([id]);

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
		this.deleteElements([id]);
	},

	deleteElements(ids: string[]) {
		const idSet = new Set(ids);
		const current = get(store).elements.filter((element) => idSet.has(element.id));
		store.update((state) => ({
			...state,
			elements: state.elements.filter((element) => !idSet.has(element.id)),
			...nextSelection(state.selectedElementIds.filter((selectedId) => !idSet.has(selectedId))),
			cropEditingElementId:
				state.cropEditingElementId && idSet.has(state.cropEditingElementId) ? null : state.cropEditingElementId
		}));
		for (const element of current) {
			if (element.type !== "image" || !element.assetId) continue;
			deleteImageAsset(element.assetId).catch((error) => {
				console.warn("Failed to delete image asset:", error);
			});
			appImageAssetState.removeAsset(element.assetId);
		}
	}
};

export type { Project };
