import { defaultBindable } from "@maply/model";
import type { Element, ElementType } from "@maply/model/types";

/** A property that can safely apply to every element in a multi-selection. */
export type SharedElementProperty =
	"name" | "x" | "y" | "width" | "height" | "centerX" | "centerY" | "radius" | "fontSize" | "fill";

/** A persisted element state that supports shared editing. */
export type SharedElementState = "locked" | "bindable" | "visible";

type SelectedElement = Pick<Element, "type">;

/** The largest selection for which the properties sidebar enables batch editing. */
export const sharedPropertySelectionLimit = 100;

const propertyMasks: Readonly<Record<SharedElementProperty, number>> = {
	name: 1 << 0,
	x: 1 << 1,
	y: 1 << 2,
	width: 1 << 3,
	height: 1 << 4,
	centerX: 1 << 5,
	centerY: 1 << 6,
	radius: 1 << 7,
	fontSize: 1 << 8,
	fill: 1 << 9
};

const propertyOrder: readonly SharedElementProperty[] = [
	"name",
	"x",
	"y",
	"width",
	"height",
	"centerX",
	"centerY",
	"radius",
	"fontSize",
	"fill"
];

const propertiesByType: Readonly<Record<ElementType, number>> = {
	rect:
		propertyMasks.name |
		propertyMasks.x |
		propertyMasks.y |
		propertyMasks.width |
		propertyMasks.height |
		propertyMasks.fill,
	circle:
		propertyMasks.name | propertyMasks.centerX | propertyMasks.centerY | propertyMasks.radius | propertyMasks.fill,
	path: propertyMasks.name | propertyMasks.x | propertyMasks.y | propertyMasks.fill,
	text:
		propertyMasks.name |
		propertyMasks.x |
		propertyMasks.y |
		propertyMasks.width |
		propertyMasks.height |
		propertyMasks.fontSize |
		propertyMasks.fill,
	image: propertyMasks.name | propertyMasks.x | propertyMasks.y | propertyMasks.width | propertyMasks.height
};

/** Returns properties supported by every selected element type in a stable display order. */
export function getSharedElementProperties(elements: readonly SelectedElement[]): SharedElementProperty[] {
	if (elements.length === 0) return [];

	let intersection = propertiesByType[elements[0].type];
	for (let index = 1; index < elements.length && intersection !== 0; index += 1) {
		intersection &= propertiesByType[elements[index].type];
	}

	return propertyOrder.filter((property) => (intersection & propertyMasks[property]) !== 0);
}

/** Reports whether a selection count is within the supported batch-editing limit. */
export function canEditSharedProperties(elementCount: number): boolean {
	return elementCount <= sharedPropertySelectionLimit;
}

function elementState(element: Pick<Element, "type" | "locked" | "bindable" | "visible">, state: SharedElementState) {
	switch (state) {
		case "locked":
			return element.locked ?? false;
		case "bindable":
			return element.bindable ?? defaultBindable(element.type);
		case "visible":
			return element.visible !== false;
	}
}

/** Returns a shared element-state value, or null when the selection contains mixed values. */
export function getSharedElementState(
	elements: readonly Pick<Element, "type" | "locked" | "bindable" | "visible">[],
	state: SharedElementState
): boolean | null {
	const first = elements[0];
	if (!first) return null;

	const value = elementState(first, state);
	return elements.every((element) => elementState(element, state) === value) ? value : null;
}
