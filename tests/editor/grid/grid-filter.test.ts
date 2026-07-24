import type { Element } from "@maply/model/types";
import { describe, expect, it } from "vitest";

import {
	elementsColumn,
	filteredRowIndexes,
	filterValues,
	searchedFilterValues
} from "../../../src/components/elements-panel/grid/grid-filter";

function element(id: string, name: string): Element {
	return {
		id,
		name,
		type: "rect",
		bindable: true,
		locked: false,
		visible: true,
		x: 0,
		y: 0,
		width: 1,
		height: 1,
		fill: "#000",
		stroke: "#000",
		strokeWidth: 0
	};
}

describe("grid filters", () => {
	it("pins the blank-name bucket while filtering other rows", () => {
		const rows = [["Alpha"], ["Beta"], [""]];
		const indexes = filteredRowIndexes(rows, [[], [], []], new Map([[0, new Set(["Alpha"])]]));

		expect(indexes).toEqual([0, 2]);
	});

	it("matches rows containing any selected element", () => {
		const rows = [["Alpha"], ["Beta"], [""]];
		const indexes = filteredRowIndexes(
			rows,
			[[element("one", "Door"), element("two", "Window")], [element("three", "Wall")], []],
			new Map([[elementsColumn, new Set(["Window", "Wall"])]])
		);

		expect(indexes).toEqual([0, 1, 2]);
	});

	it("lists blanks and distinct values in stable order", () => {
		expect(filterValues([["Beta"], [""], ["Alpha"]], [[], [], []], 0)).toEqual(["", "Alpha", "Beta"]);
	});

	it("limits a column's options to rows matching other active filters", () => {
		const rows = [
			["Alpha", "North"],
			["Beta", "South"],
			["Gamma", "North"],
			["", ""]
		];

		const filters = new Map<number, Set<string>>([[1, new Set(["North"])]]);

		expect(filterValues(rows, [[], [], [], []], 0, filters)).toEqual(["", "Alpha", "Gamma"]);
	});

	it("searches option labels without changing their exact values", () => {
		expect(searchedFilterValues(["", "Alpha", "beta"], "AL")).toEqual(["Alpha"]);
	});

	it("searches blank values by their displayed label", () => {
		expect(searchedFilterValues(["", "Alpha"], "blank")).toEqual([""]);
	});
});
