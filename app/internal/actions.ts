import type { ResizeHandle } from "$lib/app/core/element-actions";
import { canvasState } from "$lib/app/state/canvas.svelte";
import { clearClipboard, copyElement, getClipboardElement } from "$lib/app/state/clipboard.svelte";
import { projectState } from "$lib/app/state/project.svelte";

import type { Element } from "../domain/elements";
import type { Camera, ImportExportState } from "../domain/project";
import type { Tool } from "../domain/tools";
import { appToolState } from "../store/tool";

type ElementPatch = Partial<Omit<Element, "id" | "type">>;

export const appActions = {
	project: {
		setName(name: string) {
			projectState.setName(name);
		},

		setImportExportState(state: Partial<ImportExportState>) {
			projectState.setImportExportState(state);
		},

		selectElement(id: string | null) {
			projectState.selectElement(id);
		},

		setHoveredElement(id: string | null) {
			projectState.setHoveredElement(id);
		},

		updateElement(id: string, patch: ElementPatch) {
			projectState.updateElement(id, patch);
		},

		addElement(element: Element) {
			projectState.addElement(element);
		},

		translateElement(id: string, dx: number, dy: number) {
			projectState.translateElement(id, dx, dy);
		},

		setElementPosition(id: string, x: number, y: number) {
			projectState.setElementPosition(id, x, y);
		},

		clampElementsToCanvas() {
			projectState.clampElementsToCanvas();
		},

		renameElement(id: string, name: string) {
			projectState.renameElement(id, name);
		},

		setCropEditingElement(id: string | null) {
			projectState.setCropEditingElement(id);
		},

		translateImageCrop(id: string, dx: number, dy: number) {
			projectState.translateImageCrop(id, dx, dy);
		},

		resizeImageFrame(id: string, handle: ResizeHandle, dx: number, dy: number) {
			projectState.resizeImageFrame(id, handle, dx, dy);
		},

		resetImageCrop(id: string) {
			projectState.resetImageCrop(id);
		},

		setImageCropScale(id: string, cropScale: number) {
			projectState.setImageCropScale(id, cropScale);
		},

		setImageAssetFromFile(id: string, file: File) {
			return projectState.setImageAssetFromFile(id, file);
		},

		reorderElements(from: number, to: number) {
			projectState.reorderElements(from, to);
		},

		moveElementToFront(id: string) {
			projectState.moveElementToFront(id);
		},

		moveElementForward(id: string) {
			projectState.moveElementForward(id);
		},

		moveElementBackward(id: string) {
			projectState.moveElementBackward(id);
		},

		moveElementToBack(id: string) {
			projectState.moveElementToBack(id);
		}
	},

	canvas: {
		setSize(width: number, height: number) {
			canvasState.setSize(width, height);
		},

		setColor(color: string) {
			canvasState.setColor(color);
		},

		setPosition(x: number, y: number) {
			canvasState.setPosition(x, y);
		},

		setCamera(camera: Partial<Camera>) {
			canvasState.setCamera(camera);
		},

		pan(dx: number, dy: number) {
			canvasState.pan(dx, dy);
		},

		zoomIn() {
			canvasState.zoomIn();
		},

		zoomOut() {
			canvasState.zoomOut();
		},

		resetZoom() {
			canvasState.resetZoom();
		},

		resetCamera() {
			canvasState.resetCamera();
		},

		centerCamera(containerWidth: number, containerHeight: number) {
			canvasState.centerCamera(containerWidth, containerHeight);
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
		copy(element: Element) {
			copyElement(element);
		},

		clear() {
			clearClipboard();
		},

		get() {
			return getClipboardElement();
		}
	}
} as const;
