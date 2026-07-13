import type { Element } from "@maply/model/types";
import { get } from "svelte/store";

import { projectState } from "../state/document";
import { canvasState } from "../state/workspace";
import { clampElementToCanvas, getElementBounds, getPointBounds } from "./geometry";
import { toPathPoints, toPath } from "./path";
import { resizeElement as resizeElementPure, type ResizeHandle, type ResizeOptions } from "./resize";

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

function getElementPosition(element: Element) {
	return element.type === "circle" ? { x: element.cx, y: element.cy } : { x: element.x, y: element.y };
}

function getHandlePosition(
	element: Element,
	handle: ResizeHandle
): {
	x: number;
	y: number;
} {
	const bounds = getElementBounds(element);
	return {
		x: handle.includes("w")
			? bounds.x
			: handle.includes("e")
				? bounds.x + bounds.width
				: bounds.x + bounds.width / 2,
		y: handle.includes("n")
			? bounds.y
			: handle.includes("s")
				? bounds.y + bounds.height
				: bounds.y + bounds.height / 2
	};
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
export function translateElement(id: string, dx: number, dy: number) {
	if (dx === 0 && dy === 0) return { x: 0, y: 0 };

	const canvas = get(canvasState);
	let applied = { x: 0, y: 0 };

	projectState.update((state) => ({
		...state,
		elements: state.elements.map((element) => {
			if (element.id !== id) return element;
			const next = clampElementToCanvas(translate(element, dx, dy), canvas);
			const before = getElementPosition(element);
			const after = getElementPosition(next);
			applied = { x: after.x - before.x, y: after.y - before.y };
			return next;
		})
	}));

	return applied;
}

/** Moves a selection as one canvas-constrained group. */
export function translateElements(ids: readonly string[], dx: number, dy: number) {
	if (ids.length === 0 || (dx === 0 && dy === 0)) return { x: 0, y: 0 };

	const idSet = new Set(ids);
	const canvas = get(canvasState);
	let applied = { x: 0, y: 0 };

	projectState.update((state) => {
		const selected = state.elements.filter((element) => idSet.has(element.id));
		if (selected.length === 0) return state;

		const bounds = selected.map(getElementBounds);

		const groupX = Math.min(...bounds.map((b) => b.x));
		const groupY = Math.min(...bounds.map((b) => b.y));
		const groupWidth = Math.max(...bounds.map((b) => b.x + b.width)) - groupX;
		const groupHeight = Math.max(...bounds.map((b) => b.y + b.height)) - groupY;

		const minDx = Math.max(...bounds.map((b) => canvas.x - b.x));
		const maxDx = Math.min(...bounds.map((b) => canvas.x + canvas.width - b.x - b.width));
		const minDy = Math.max(...bounds.map((b) => canvas.y - b.y));
		const maxDy = Math.min(...bounds.map((b) => canvas.y + canvas.height - b.y - b.height));

		const nextDx = Math.round(groupWidth > canvas.width ? canvas.x - groupX : Math.min(maxDx, Math.max(minDx, dx)));
		const nextDy = Math.round(
			groupHeight > canvas.height ? canvas.y - groupY : Math.min(maxDy, Math.max(minDy, dy))
		);
		applied = { x: nextDx, y: nextDy };

		if (nextDx === 0 && nextDy === 0) return state;

		return {
			...state,
			elements: state.elements.map((element) =>
				idSet.has(element.id) ? translate(element, nextDx, nextDy) : element
			)
		};
	});

	return applied;
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

/** Resizes an element by a handle delta within canvas bounds. */
export function resizeElementByHandle(
	id: string,
	handle: ResizeHandle,
	dx: number,
	dy: number,
	options?: ResizeOptions
) {
	if (dx === 0 && dy === 0) return { x: 0, y: 0 };

	const canvas = get(canvasState);
	let applied = { x: 0, y: 0 };

	projectState.update((state) => ({
		...state,
		elements: state.elements.map((element) => {
			if (element.id !== id) return element;
			const before = getHandlePosition(element, handle);
			const next = resizeElementPure(element, handle, dx, dy, canvas, options);
			const after = getHandlePosition(next, handle);
			applied = { x: after.x - before.x, y: after.y - before.y };
			return next;
		})
	}));

	return applied;
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

/** Raw name commit — callers may write invalid or duplicate names; validation is advisory. */
export function renameElement(id: string, name: string): void {
	projectState.update((state) => ({
		...state,
		elements: state.elements.map((element) => (element.id === id ? { ...element, name } : element))
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

/** Rewrites one linear-path vertex and clamps the resulting path frame. */
export function updatePathVertex(id: string, index: number, point: { x: number; y: number }): void {
	const canvas = get(canvasState);

	projectState.update((state) => ({
		...state,
		elements: state.elements.map((element) => {
			if (element.id !== id || element.type !== "path") return element;

			const points = toPathPoints(element.d);
			if (index < 0 || index >= points.length) return element;

			const oldBounds = getPointBounds(points);
			points[index] = point;
			const newBounds = getPointBounds(points);

			return clampElementToCanvas(
				{
					...element,
					d: toPath(points, element.closed),
					x: Math.round(element.x + (newBounds.x - oldBounds.x)),
					y: Math.round(element.y + (newBounds.y - oldBounds.y))
				},
				canvas
			);
		})
	}));
}
