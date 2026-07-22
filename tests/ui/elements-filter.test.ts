import type { Element, ElementType } from "@maply/model/types";
import { describe, expect, it } from "vitest";

import { elementNamesCsv, elementTypes, filterElements, toggleType } from "../../src/components/elements-panel/filter";

const elements = [element("rectangle", "rect"), element("circle", "circle"), element("quoted, name", "text")];

describe("elements panel filters", () => {
	it("filters by type before applying a name search", () => {
		expect(filterElements(elements, ["rect", "text"], "rect").map((element) => element.name)).toEqual([
			"rectangle"
		]);
	});

	it("treats an empty type selection as every type", () => {
		expect(filterElements(elements, [], "")).toEqual(elements);
	});

	it("exports names as escaped headerless CSV", () => {
		expect(elementNamesCsv(elements)).toBe('rectangle\r\ncircle\r\n"quoted, name"');
	});

	it("resets the type filter after selecting every type", () => {
		let selected: ElementType[] = ["rect"];
		for (const type of elementTypes.filter((type) => type !== "rect")) {
			selected = toggleType(selected, type, true);
		}
		expect(selected).toEqual([]);
	});

	it("resets the type filter after clearing its final type", () => {
		expect(toggleType(["rect"], "rect", false)).toEqual([]);
	});
});

function element(name: string, type: ElementType) {
	return { id: name, name, type } as Element;
}
