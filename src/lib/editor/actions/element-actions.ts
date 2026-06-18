import type { Element, ElementType, RectElement } from "$lib/editor/model/elements";
import type { Point } from "$lib/editor/model/geometry";

const PASTE_OFFSET = 20;

const defaultNames: Record<ElementType, string> = {
	rect: "rectangle",
	circle: "circle",
	path: "path",
	text: "text",
	image: "image"
};

export function createElementId(): string {
	if (typeof crypto !== "undefined" && crypto.randomUUID) {
		return crypto.randomUUID();
	}

	return Math.random().toString(36).slice(2);
}

export function defaultElementName(type: ElementType): string {
	return defaultNames[type];
}

export function nextElementName(type: ElementType, elements: Element[]): string {
	const count = elements.filter((element) => element.type === type).length;
	return `${defaultElementName(type)}${count + 1}`;
}

export function normalizeElement(element: Element): Element {
	const normalized: Element = {
		...element,
		name: element.name?.trim() || defaultElementName(element.type)
	};

	if (normalized.type === "path" && (typeof normalized.x !== "number" || typeof normalized.y !== "number")) {
		normalized.x = 0;
		normalized.y = 0;
	}

	return normalized;
}

export function normalizeElements(elements: Element[]): Element[] {
	return elements.map(normalizeElement);
}

export function translateElement(element: Element, dx: number, dy: number): Element {
	switch (element.type) {
		case "rect":
		case "text":
		case "image":
		case "path":
			return { ...element, x: Math.round(element.x + dx), y: Math.round(element.y + dy) };
		case "circle":
			return { ...element, cx: Math.round(element.cx + dx), cy: Math.round(element.cy + dy) };
	}
}

export function duplicateElement(element: Element, offset = PASTE_OFFSET): Element {
	const next = translateElement(structuredClone(element), offset, offset);
	return {
		...next,
		id: createElementId(),
		name: `${next.name} copy`
	} as Element;
}

export function createRectElement(point: Point, elements: Element[]): RectElement {
	return {
		id: createElementId(),
		name: nextElementName("rect", elements),
		type: "rect",
		x: Math.round(point.x),
		y: Math.round(point.y),
		width: 120,
		height: 80,
		fill: "#000000",
		stroke: "#000000",
		strokeWidth: 0
	};
}
