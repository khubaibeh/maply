import type { Element, ElementType } from "@maply/model/types";

export const elementTypeLabels = {
	rect: "Rectangle",
	circle: "Circle",
	path: "Path",
	text: "Text",
	image: "Image"
} satisfies Record<ElementType, string>;

export const elementTypes = Object.keys(elementTypeLabels) as readonly ElementType[];

/** Returns elements that match the optional type filter and name search. */
export function filterElements(elements: readonly Element[], selectedTypes: readonly ElementType[], search: string) {
	const selected = new Set(selectedTypes);
	return elements.filter(
		(element) =>
			(selected.size === 0 || selected.has(element.type)) && element.name.toLocaleLowerCase().includes(search)
	);
}

/** Serializes element names as a one-column CSV file. */
export function elementNamesCsv(elements: readonly Element[]) {
	return elements.map((element) => csvCell(element.name)).join("\r\n");
}

function csvCell(value: string) {
	return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/** Toggles a type in the selection, normalizing "all selected" back to empty. */
export function toggleType(selectedTypes: readonly ElementType[], type: ElementType, selected: boolean): ElementType[] {
	const next = selected ? [...new Set([...selectedTypes, type])] : selectedTypes.filter((entry) => entry !== type);
	return next.length === elementTypes.length ? [] : next;
}
