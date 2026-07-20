import type { Element, ElementType } from "@maply/model/types";

/** A property that can safely apply to every element in a multi-selection. */
export type SharedElementProperty =
	"x" | "y" | "width" | "height" | "centerX" | "centerY" | "radius" | "fontSize" | "fill";

type SelectedElement = Pick<Element, "type">;

/** The largest selection for which the properties sidebar enables batch editing. */
export const sharedPropertySelectionLimit = 100;

const propertyMasks: Readonly<Record<SharedElementProperty, number>> = {
	x: 1 << 0,
	y: 1 << 1,
	width: 1 << 2,
	height: 1 << 3,
	centerX: 1 << 4,
	centerY: 1 << 5,
	radius: 1 << 6,
	fontSize: 1 << 7,
	fill: 1 << 8
};

const propertyOrder: readonly SharedElementProperty[] = [
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
	rect: propertyMasks.x | propertyMasks.y | propertyMasks.width | propertyMasks.height | propertyMasks.fill,
	circle: propertyMasks.centerX | propertyMasks.centerY | propertyMasks.radius | propertyMasks.fill,
	path: propertyMasks.x | propertyMasks.y | propertyMasks.fill,
	text:
		propertyMasks.x |
		propertyMasks.y |
		propertyMasks.width |
		propertyMasks.height |
		propertyMasks.fontSize |
		propertyMasks.fill,
	image: propertyMasks.x | propertyMasks.y | propertyMasks.width | propertyMasks.height
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
