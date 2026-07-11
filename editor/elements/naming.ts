import type { Element, ElementType } from "@maply/model/types";

const defaultNames: Record<ElementType, string> = {
	rect: "rectangle",
	circle: "circle",
	path: "path",
	text: "text",
	image: "image"
};

/** Generates an element ID without requiring a browser-only dependency. */
export function createElementId(): string {
	if (typeof crypto !== "undefined" && crypto.randomUUID) {
		return crypto.randomUUID();
	}

	return Math.random().toString(36).slice(2);
}

/** Returns the default base name for an element type. */
export function defaultElementName(type: ElementType): string {
	return defaultNames[type];
}

/** Produces a unique name for a new element of the given type. */
export function nextElementName(type: ElementType, elements: readonly Element[]): string {
	const base = defaultElementName(type);
	const names = new Set(elements.map((element) => element.name.trim()));

	let n = elements.filter((element) => element.type === type).length + 1;
	while (names.has(`${base}${n}`)) n++;

	return `${base}${n}`;
}
