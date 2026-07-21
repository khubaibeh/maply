import type { ElementType } from "@maply/model/types";
import { describe, expect, it } from "vitest";

import {
	canEditSharedProperties,
	getSharedElementProperties,
	sharedPropertySelectionLimit,
	type SharedElementProperty
} from "../../src/components/properties/shared-properties";

type PropertyCase = {
	types: readonly ElementType[];
	expected: readonly SharedElementProperty[];
};

const cases: readonly PropertyCase[] = [
	{ types: ["rect"], expected: ["x", "y", "width", "height", "fill"] },
	{ types: ["circle"], expected: ["centerX", "centerY", "radius", "fill"] },
	{ types: ["path"], expected: ["x", "y", "fill"] },
	{ types: ["text"], expected: ["x", "y", "width", "height", "fontSize", "fill"] },
	{ types: ["image"], expected: ["x", "y", "width", "height"] },
	{ types: ["rect", "circle"], expected: ["fill"] },
	{ types: ["rect", "path"], expected: ["x", "y", "fill"] },
	{ types: ["rect", "text"], expected: ["x", "y", "width", "height", "fill"] },
	{ types: ["rect", "image"], expected: ["x", "y", "width", "height"] },
	{ types: ["circle", "path"], expected: ["fill"] },
	{ types: ["circle", "text"], expected: ["fill"] },
	{ types: ["circle", "image"], expected: [] },
	{ types: ["path", "text"], expected: ["x", "y", "fill"] },
	{ types: ["path", "image"], expected: ["x", "y"] },
	{ types: ["text", "image"], expected: ["x", "y", "width", "height"] },
	{ types: ["rect", "circle", "path"], expected: ["fill"] },
	{ types: ["rect", "circle", "text"], expected: ["fill"] },
	{ types: ["rect", "circle", "image"], expected: [] },
	{ types: ["rect", "path", "text"], expected: ["x", "y", "fill"] },
	{ types: ["rect", "path", "image"], expected: ["x", "y"] },
	{ types: ["rect", "text", "image"], expected: ["x", "y", "width", "height"] },
	{ types: ["circle", "path", "text"], expected: ["fill"] },
	{ types: ["circle", "path", "image"], expected: [] },
	{ types: ["circle", "text", "image"], expected: [] },
	{ types: ["path", "text", "image"], expected: ["x", "y"] },
	{ types: ["rect", "circle", "path", "text"], expected: ["fill"] },
	{ types: ["rect", "circle", "path", "image"], expected: [] },
	{ types: ["rect", "circle", "text", "image"], expected: [] },
	{ types: ["rect", "path", "text", "image"], expected: ["x", "y"] },
	{ types: ["circle", "path", "text", "image"], expected: [] },
	{ types: ["rect", "circle", "path", "text", "image"], expected: [] }
];

describe("getSharedElementProperties", () => {
	it("returns no properties for an empty selection", () => {
		expect(getSharedElementProperties([])).toEqual([]);
	});

	it("intersects a selection of one thousand elements", () => {
		const rect = { type: "rect" } satisfies { type: ElementType };
		const elements = Array.from({ length: 1_000 }, () => rect);

		expect(getSharedElementProperties(elements)).toEqual(["name", "x", "y", "width", "height", "fill"]);
	});

	it("limits batch property editing to one hundred selected elements", () => {
		expect(sharedPropertySelectionLimit).toBe(100);
		expect(canEditSharedProperties(100)).toBe(true);
		expect(canEditSharedProperties(101)).toBe(false);
	});

	it.each(cases)("intersects $types", ({ types, expected }) => {
		expect(getSharedElementProperties(types.map((type) => ({ type })))).toEqual(["name", ...expected]);
	});
});
