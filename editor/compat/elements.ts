import type { Element } from "@maply/model/types";
import { get } from "svelte/store";

import { resizeElement, type ResizeHandle, type ResizeOptions } from "../elements/resize";
import { projectState } from "../state/document";
import { canvasState } from "../state/workspace";
import { clampElementToCanvas, getElementBounds } from "./geometry";
import { getWrappedTextMetrics } from "./text";

export function resizeElementByHandle(
	id: string,
	handle: ResizeHandle,
	dx: number,
	dy: number,
	options?: ResizeOptions
): void {
	const canvas = get(canvasState);
	projectState.update((state) => ({
		...state,
		elements: state.elements.map((element) => {
			if (element.id !== id) return element;
			let source = element;
			if (element.type === "text") {
				const metrics = getWrappedTextMetrics(element);
				source = { ...element, x: element.x - metrics.left, y: element.y - metrics.ascent + element.fontSize };
			}
			const resized = resizeElement(source, handle, dx, dy, canvas, options);
			if (resized.type === "text") {
				const metrics = getWrappedTextMetrics(element.type === "text" ? element : resized);
				return {
					...resized,
					x: Math.round(resized.x + metrics.left),
					y: Math.round(resized.y - resized.fontSize + metrics.ascent),
					width: Math.max(5, resized.width),
					height: Math.max(5, resized.height)
				};
			}
			if (resized.type === "rect" || resized.type === "image") {
				return { ...resized, width: Math.max(5, resized.width), height: Math.max(5, resized.height) };
			}
			return resized;
		})
	}));
}

export function translateElement(id: string, dx: number, dy: number): void {
	translateElements([id], dx, dy);
}

export function translateElements(ids: readonly string[], dx: number, dy: number): void {
	const canvas = get(canvasState);
	projectState.update((state) => ({
		...state,
		elements: state.elements.map((element) => {
			if (!ids.includes(element.id)) return element;
			const moved =
				element.type === "circle"
					? { ...element, cx: element.cx + dx, cy: element.cy + dy }
					: { ...element, x: element.x + dx, y: element.y + dy };
			return clampElementToCanvas(moved as Element, canvas);
		})
	}));
}

export function setElementPosition(id: string, x: number, y: number): void {
	const canvas = get(canvasState);
	projectState.update((state) => ({
		...state,
		elements: state.elements.map((element) => {
			if (element.id !== id) return element;
			const bounds = getElementBounds(element);
			const moved =
				element.type === "circle"
					? { ...element, cx: element.cx + x - bounds.x, cy: element.cy + y - bounds.y }
					: { ...element, x: element.x + x - bounds.x, y: element.y + y - bounds.y };
			return clampElementToCanvas(moved as Element, canvas);
		})
	}));
}

export function clampElementsToCanvas(): void {
	const canvas = get(canvasState);
	projectState.update((state) => ({
		...state,
		elements: state.elements.map((element) => clampElementToCanvas(element, canvas))
	}));
}
