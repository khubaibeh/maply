import { getImageRenderRect, getLegacyImageRenderRect } from "@maply/model";
import type { Canvas, Element } from "@maply/model/types";
import { get } from "svelte/store";

import { clampCropScale, resizeImageRect, scaleImageRect, withImageRect } from "../image/crop";
import { imageAssetState } from "../state/assets";
import { projectState, setProjectState, updateProjectState } from "../state/document";
import { updateInteractionState } from "../state/interaction";
import { canvasState } from "../state/workspace";
import type { ImageAssetState } from "../types";
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

	updateProjectState(
		(state) => ({
			...state,
			elements: [...state.elements, next]
		}),
		{ added: [next] }
	);
	updateInteractionState((state) => ({
		...state,
		selectedElementId: next.id,
		selectedElementIds: [next.id],
		hoveredElementId: null,
		cropEditingElementId: null
	}));
}

/** Moves one element while retaining it within the canvas. */
export function translateElement(id: string, dx: number, dy: number) {
	if (dx === 0 && dy === 0) return { x: 0, y: 0 };

	const canvas = get(canvasState);
	let applied = { x: 0, y: 0 };

	updateProjectState(
		(state) => ({
			...state,
			elements: state.elements.map((element) => {
				if (element.id !== id || element.locked) return element;
				const next = clampElementToCanvas(translate(element, dx, dy), canvas);
				const before = getElementPosition(element);
				const after = getElementPosition(next);
				applied = { x: after.x - before.x, y: after.y - before.y };
				return next;
			})
		}),
		"preserve"
	);

	return applied;
}

/** Moves a selection as one canvas-constrained group. */
export function translateElements(ids: readonly string[], dx: number, dy: number) {
	if (ids.length === 0 || (dx === 0 && dy === 0)) return { x: 0, y: 0 };

	const idSet = new Set(ids);
	const canvas = get(canvasState);
	let applied = { x: 0, y: 0 };

	updateProjectState((state) => {
		const selected = state.elements.filter((element) => idSet.has(element.id) && !element.locked);
		if (selected.length === 0) return state;
		const movableIds = new Set(selected.map((element) => element.id));

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
				movableIds.has(element.id) ? translate(element, nextDx, nextDy) : element
			)
		};
	}, "preserve");

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

/** Resizes an element by a handle delta from its current or pointer-down source geometry. */
export function resizeElementByHandle(
	id: string,
	handle: ResizeHandle,
	dx: number,
	dy: number,
	options?: ResizeOptions,
	source?: Element
) {
	if (dx === 0 && dy === 0) return { x: 0, y: 0 };

	const state = get(projectState);
	const canvas = get(canvasState);
	const assets = get(imageAssetState);
	let applied = { x: 0, y: 0 };
	let beforeChange: Element | null = null;
	let afterChange: Element | null = null;

	const nextState = {
		...state,
		elements: state.elements.map((element) => {
			if (element.id !== id) return element;
			const original = source?.id === id ? source : element;
			const resized = resizeElementPure(original, handle, dx, dy, canvas, options);
			const next = resizeImageTransform(original, resized, assets);
			const before = getHandlePosition(element, handle);
			const after = getHandlePosition(next, handle);
			applied = { x: after.x - before.x, y: after.y - before.y };
			beforeChange = element;
			afterChange = next;
			return next;
		})
	};
	const hint = beforeChange && afterChange ? { changed: { before: beforeChange, after: afterChange } } : "preserve";

	setProjectState(nextState, hint);

	return applied;
}

function resizeImageTransform(previous: Element, next: Element, assets: ImageAssetState): Element {
	if (previous.type !== "image" || next.type !== "image") return next;
	const asset = previous.assetId ? assets[previous.assetId] : null;
	if (!asset) return next;
	const rect = getImageRenderRect(previous, asset);

	return withImageRect(
		{ ...next, cropX: previous.cropX, cropY: previous.cropY, cropScale: previous.cropScale },
		resizeImageRect(rect, previous, next)
	);
}

function updateImageTransform(
	previous: Element,
	next: Element,
	patch: Partial<Element>,
	assets: ImageAssetState
): Element {
	if (previous.type !== "image" || next.type !== "image") return next;
	const asset = previous.assetId ? assets[previous.assetId] : null;
	if (!asset) return next;

	if (hasImageRectPatch(patch)) {
		const current = getImageRenderRect(previous, asset);
		return withImageRect(next, {
			x: typeof next.imageX === "number" ? next.imageX : current.x,
			y: typeof next.imageY === "number" ? next.imageY : current.y,
			width: typeof next.imageWidth === "number" ? next.imageWidth : current.width,
			height: typeof next.imageHeight === "number" ? next.imageHeight : current.height
		});
	}

	if ("cropX" in patch || "cropY" in patch) {
		return withImageRect(next, getLegacyImageRenderRect(next, asset));
	}

	let rect = getImageRenderRect(previous, asset);
	if (previous.width !== next.width || previous.height !== next.height) {
		rect = resizeImageRect(rect, previous, next);
	}

	if ("cropScale" in patch) {
		const cropScale = clampCropScale(next.cropScale);
		return withImageRect({ ...next, cropScale }, scaleImageRect(rect, next, previous.cropScale, cropScale));
	}

	return previous.width !== next.width || previous.height !== next.height ? withImageRect(next, rect) : next;
}

function hasImageRectPatch(patch: Partial<Element>): boolean {
	return "imageX" in patch || "imageY" in patch || "imageWidth" in patch || "imageHeight" in patch;
}

function normalizeNamePatch(patch: Partial<Element>): Partial<Element> {
	if (patch.name === undefined) return patch;

	const { name, ...rest } = patch;
	const trimmedName = name.trim();
	return trimmedName ? { ...rest, name: trimmedName } : rest;
}

/** Applies an element property patch and clamps the resulting element. */
export function updateElement(id: string, patch: Partial<Element>): void {
	const state = get(projectState);
	const canvas = get(canvasState);
	const assets = get(imageAssetState);
	const normalizedPatch = normalizeNamePatch(patch);
	let beforeChange: Element | null = null;
	let afterChange: Element | null = null;

	const nextState = {
		...state,
		elements: state.elements.map((element) => {
			if (element.id !== id) return element;
			const clamped = clampElementToCanvas({ ...element, ...normalizedPatch } as Element, canvas);
			const next = updateImageTransform(element, clamped, normalizedPatch, assets);
			beforeChange = element;
			afterChange = next;
			return next;
		})
	};
	const hint = beforeChange && afterChange ? { changed: { before: beforeChange, after: afterChange } } : "preserve";

	setProjectState(nextState, hint);
}

/** Applies one property patch to every identified element in a single state transition. */
export function updateElements(ids: readonly string[], patch: Partial<Element>): void {
	if (ids.length === 0) return;

	const idSet = new Set(ids);
	const canvas = get(canvasState);
	const assets = get(imageAssetState);
	const normalizedPatch = normalizeNamePatch(patch);

	updateProjectState(
		(state) => ({
			...state,
			elements: state.elements.map((element) => {
				if (!idSet.has(element.id)) return element;
				const clamped = clampElementToCanvas({ ...element, ...normalizedPatch } as Element, canvas);
				return updateImageTransform(element, clamped, normalizedPatch, assets);
			})
		}),
		"rescan"
	);
}

/** Commits a nonblank name; selector-safety and duplicate validation remains advisory. */
export function renameElement(id: string, name: string): void {
	const trimmedName = name.trim();
	if (!trimmedName) return;

	updateProjectState(
		(state) => ({
			...state,
			elements: state.elements.map((element) => (element.id === id ? { ...element, name: trimmedName } : element))
		}),
		"preserve"
	);
}

/** Clamps every element after a canvas frame change. */
export function clampElementsToCanvas(): void {
	const canvas = get(canvasState);

	updateProjectState(
		(state) => ({
			...state,
			elements: state.elements.map((element) => clampElementToCanvas(element, canvas))
		}),
		"rescan"
	);
}

/** Rewrites one linear-path vertex and clamps the resulting path frame. */
export function updatePathVertex(id: string, index: number, point: { x: number; y: number }): void {
	const state = get(projectState);
	const canvas = get(canvasState);
	let beforeChange: Element | null = null;
	let afterChange: Element | null = null;

	const nextState = {
		...state,
		elements: state.elements.map((element) => {
			if (element.id !== id || element.type !== "path" || element.locked) return element;

			const points = toPathPoints(element.d);
			if (index < 0 || index >= points.length) return element;

			const oldBounds = getPointBounds(points);
			points[index] = point;
			const newBounds = getPointBounds(points);

			const next = clampElementToCanvas(
				{
					...element,
					d: toPath(points, element.closed),
					x: Math.round(element.x + (newBounds.x - oldBounds.x)),
					y: Math.round(element.y + (newBounds.y - oldBounds.y))
				},
				canvas
			);
			beforeChange = element;
			afterChange = next;
			return next;
		})
	};
	const hint = beforeChange && afterChange ? { changed: { before: beforeChange, after: afterChange } } : "preserve";

	setProjectState(nextState, hint);
}

/** Inserts a vertex after the path segment closest to the supplied path-local point. */
export function insertPathVertex(id: string, point: { x: number; y: number }): void {
	const state = get(projectState);
	const canvas = get(canvasState);
	let beforeChange: Element | null = null;
	let afterChange: Element | null = null;

	const nextState = {
		...state,
		elements: state.elements.map((element) => {
			if (element.id !== id || element.type !== "path" || element.locked) return element;

			const points = toPathPoints(element.d);
			const insertionIndex = getPathVertexInsertionIndex(points, element.closed, point);
			if (insertionIndex === null) return element;

			const nextPoints = [...points];
			nextPoints.splice(insertionIndex, 0, point);
			const next = rewritePathPoints(element, nextPoints, canvas);
			beforeChange = element;
			afterChange = next;
			return next;
		})
	};

	setProjectState(
		nextState,
		beforeChange && afterChange ? { changed: { before: beforeChange, after: afterChange } } : "preserve"
	);
}

/** Removes one vertex when doing so leaves the path with a valid number of vertices. */
export function removePathVertex(id: string, index: number): void {
	const state = get(projectState);
	const canvas = get(canvasState);
	let beforeChange: Element | null = null;
	let afterChange: Element | null = null;

	const nextState = {
		...state,
		elements: state.elements.map((element) => {
			if (element.id !== id || element.type !== "path" || element.locked) return element;

			const points = toPathPoints(element.d);
			const minimumVertexCount = element.closed ? 3 : 2;
			if (index < 0 || index >= points.length || points.length <= minimumVertexCount) return element;

			const nextPoints = points.filter((_, pointIndex) => pointIndex !== index);
			const next = rewritePathPoints(element, nextPoints, canvas);
			beforeChange = element;
			afterChange = next;
			return next;
		})
	};

	setProjectState(
		nextState,
		beforeChange && afterChange ? { changed: { before: beforeChange, after: afterChange } } : "preserve"
	);
}

function rewritePathPoints(
	element: Extract<Element, { type: "path" }>,
	points: readonly { x: number; y: number }[],
	canvas: Canvas
) {
	const oldBounds = getPointBounds(toPathPoints(element.d));
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
}

function getPathVertexInsertionIndex(
	points: readonly { x: number; y: number }[],
	closed: boolean,
	point: { x: number; y: number }
) {
	const segmentCount = closed ? points.length : points.length - 1;
	if (segmentCount <= 0) return null;

	let closestIndex = 0;
	let closestDistance = Infinity;
	for (let index = 0; index < segmentCount; index += 1) {
		const start = points[index];
		const end = points[(index + 1) % points.length];
		if (!start || !end) continue;

		const distance = squaredDistanceToSegment(point, start, end);
		if (distance < closestDistance) {
			closestIndex = index;
			closestDistance = distance;
		}
	}

	return closestIndex + 1;
}

function squaredDistanceToSegment(
	point: { x: number; y: number },
	start: { x: number; y: number },
	end: { x: number; y: number }
) {
	const dx = end.x - start.x;
	const dy = end.y - start.y;
	const lengthSquared = dx * dx + dy * dy;
	if (lengthSquared === 0) return (point.x - start.x) ** 2 + (point.y - start.y) ** 2;

	const projection = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
	const x = start.x + projection * dx;
	const y = start.y + projection * dy;
	return (point.x - x) ** 2 + (point.y - y) ** 2;
}
