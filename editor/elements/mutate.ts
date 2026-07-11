import type { Element } from "@maply/model/types";
import { get } from "svelte/store";

import { projectState } from "../state/document";
import { canvasState } from "../state/workspace";
import { clampElementToCanvas } from "./geometry";

function translate(element: Element, dx: number, dy: number): Element {
	switch (element.type) {
		case "circle":
			return { ...element, cx: Math.round(element.cx + dx), cy: Math.round(element.cy + dy) };
		case "rect":
		case "text":
		case "image":
		case "path":
			return { ...element, x: Math.round(element.x + dx), y: Math.round(element.y + dy) };
	}
}

/** Adds a canvas-clamped element and selects it. */
export function addElement(element: Element): void {
	const canvas = get(canvasState);
	const next = clampElementToCanvas(element, canvas);

	projectState.update((state) => ({
		...state,
		elements: [...state.elements, next],
		selectedElementId: next.id,
		selectedElementIds: [next.id]
	}));
}

/** Moves one element while retaining it within the canvas. */
export function translateElement(id: string, dx: number, dy: number): void {
	if (dx === 0 && dy === 0) return;

	const canvas = get(canvasState);

	projectState.update((state) => ({
		...state,
		elements: state.elements.map((element) =>
			element.id === id ? clampElementToCanvas(translate(element, dx, dy), canvas) : element
		)
	}));
}

/** Positions one element using its circle center or top-left anchor. */
export function setElementPosition(id: string, x: number, y: number): void {
	const element = get(projectState).elements.find((candidate) => candidate.id === id);

	if (!element) return;

	translateElement(
		id,
		x - (element.type === "circle" ? element.cx : element.x),
		y - (element.type === "circle" ? element.cy : element.y)
	);
}

/** Applies an element property patch and clamps the resulting element. */
export function updateElement(id: string, patch: Partial<Element>): void {
	const canvas = get(canvasState);

	projectState.update((state) => ({
		...state,
		elements: state.elements.map((element) =>
			element.id === id ? clampElementToCanvas({ ...element, ...patch } as Element, canvas) : element
		)
	}));
}

/** Clamps every element after a canvas frame change. */
export function clampElementsToCanvas(): void {
	const canvas = get(canvasState);

	projectState.update((state) => ({
		...state,
		elements: state.elements.map((element) => clampElementToCanvas(element, canvas))
	}));
}
