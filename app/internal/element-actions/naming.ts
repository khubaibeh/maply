import type { Element, ElementType } from "../../domain/elements";
import { createUniqueElementName } from "../element-name-validation";

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
	return createUniqueElementName(`${defaultElementName(type)}${count + 1}`, elements);
}
