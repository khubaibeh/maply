import type { Element } from "../domain/elements";
import type { Camera, ImportExportState } from "../domain/project";
import type { Tool } from "../domain/tools";
import { appCanvasState } from "../store/canvas";
import { clearClipboard, copyElements, getClipboardElements } from "../store/clipboard.svelte";
import { appFillState } from "../store/fill";
import { appProjectState } from "../store/project";
import { appToolState } from "../store/tool";
import type { ResizeHandle, ResizeOptions } from "./element-actions";

type ElementPatch = Partial<Omit<Element, "id" | "type">>;

export const appActions = {
	project: {
		setName(name: string) {
			appProjectState.setName(name);
		},

		setImportExportState(state: Partial<ImportExportState>) {
			appProjectState.setImportExportState(state);
		},

		selectElement(id: string | null, options?: { additive?: boolean }) {
			appProjectState.selectElement(id, options);
		},

		setHoveredElement(id: string | null) {
			appProjectState.setHoveredElement(id);
		},

		updateElement(id: string, patch: ElementPatch) {
			appProjectState.updateElement(id, patch);
		},

		addElement(element: Element) {
			appProjectState.addElement(element);
		},

		translateElement(id: string, dx: number, dy: number) {
			appProjectState.translateElement(id, dx, dy);
		},

		translateElements(ids: string[], dx: number, dy: number) {
			appProjectState.translateElements(ids, dx, dy);
		},

		setElementPosition(id: string, x: number, y: number) {
			appProjectState.setElementPosition(id, x, y);
		},

		clampElementsToCanvas() {
			appProjectState.clampElementsToCanvas();
		},

		renameElement(id: string, name: string) {
			appProjectState.renameElement(id, name);
		},

		setCropEditingElement(id: string | null) {
			appProjectState.setCropEditingElement(id);
		},

		translateImageCrop(id: string, dx: number, dy: number) {
			appProjectState.translateImageCrop(id, dx, dy);
		},

		resizeImageFrame(id: string, handle: ResizeHandle, dx: number, dy: number) {
			appProjectState.resizeImageFrame(id, handle, dx, dy);
		},

		resizeElement(id: string, handle: ResizeHandle, dx: number, dy: number, options?: ResizeOptions) {
			appProjectState.resizeElement(id, handle, dx, dy, options);
		},

		resetImageCrop(id: string) {
			appProjectState.resetImageCrop(id);
		},

		setImageCropScale(id: string, cropScale: number) {
			appProjectState.setImageCropScale(id, cropScale);
		},

		setImageAssetFromFile(id: string, file: File) {
			return appProjectState.setImageAssetFromFile(id, file);
		},

		reorderElements(from: number, to: number) {
			appProjectState.reorderElements(from, to);
		},

		moveElementToFront(id: string) {
			appProjectState.moveElementToFront(id);
		},

		moveElementForward(id: string) {
			appProjectState.moveElementForward(id);
		},

		moveElementBackward(id: string) {
			appProjectState.moveElementBackward(id);
		},

		moveElementToBack(id: string) {
			appProjectState.moveElementToBack(id);
		}
	},

	canvas: {
		setSize(width: number, height: number) {
			appCanvasState.setSize(width, height);
		},

		setColor(color: string) {
			appCanvasState.setColor(color);
		},

		setPosition(x: number, y: number) {
			appCanvasState.setPosition(x, y);
		},

		setCamera(camera: Partial<Camera>) {
			appCanvasState.setCamera(camera);
		},

		pan(dx: number, dy: number) {
			appCanvasState.pan(dx, dy);
		},

		zoomIn() {
			appCanvasState.zoomIn();
		},

		zoomOut() {
			appCanvasState.zoomOut();
		},

		resetZoom() {
			appCanvasState.resetZoom();
		},

		resetCamera() {
			appCanvasState.resetCamera();
		},

		centerCamera(containerWidth: number, containerHeight: number) {
			appCanvasState.centerCamera(containerWidth, containerHeight);
		}
	},

	fill: {
		set(color: string) {
			appFillState.setDefaultFill(color);
		},

		get() {
			return appFillState.getSnapshot();
		}
	},

	tool: {
		set(tool: Tool) {
			appToolState.setTool(tool);
		},

		setSpacePressed(value: boolean) {
			appToolState.setSpacePressed(value);
		}
	},

	clipboard: {
		copy(elements: Element | Element[]) {
			copyElements(Array.isArray(elements) ? elements : [elements]);
		},

		clear() {
			clearClipboard();
		},

		get() {
			return getClipboardElements();
		}
	}
} as const;
