import { describe, expect, it } from "vitest";

import { sortedRowIndexes } from "../../../src/components/elements-panel/grid/grid-sort";

describe("grid sorting", () => {
	it("sorts values naturally without moving the blank-name row", () => {
		const rows = [["item-10"], ["item-2"], ["item-1"], [""]];

		expect(sortedRowIndexes(rows, [0, 1, 2, 3], { column: 0, direction: "ascending" })).toEqual([2, 1, 0, 3]);
	});

	it("sorts descending without moving the blank-name row", () => {
		const rows = [["Alpha"], ["Gamma"], ["Beta"], [""]];

		expect(sortedRowIndexes(rows, [0, 1, 2, 3], { column: 0, direction: "descending" })).toEqual([1, 2, 0, 3]);
	});

	it("preserves the filtered row order when sorting is off", () => {
		const rows = [["Alpha"], ["Beta"], [""]];

		expect(sortedRowIndexes(rows, [1, 0, 2], null)).toEqual([1, 0, 2]);
	});
});
