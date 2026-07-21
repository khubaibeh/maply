import { canReorderSelection, reorderSelection } from "editor/selection/ordering";
import { describe, expect, it } from "vitest";

const elements = ["a", "b", "c", "d", "e"].map((id) => ({ id }));

describe("selection ordering", () => {
	it("moves a noncontiguous selection to the front or back without changing selected order", () => {
		expect(reorderSelection(elements, ["b", "d"], "front").map((element) => element.id)).toEqual([
			"a",
			"c",
			"e",
			"b",
			"d"
		]);
		expect(reorderSelection(elements, ["b", "d"], "back").map((element) => element.id)).toEqual([
			"b",
			"d",
			"a",
			"c",
			"e"
		]);
	});

	it("moves a contiguous selection across one unselected layer", () => {
		expect(reorderSelection(elements, ["b", "c"], "forward").map((element) => element.id)).toEqual([
			"a",
			"d",
			"b",
			"c",
			"e"
		]);
		expect(reorderSelection(elements, ["b", "c"], "backward").map((element) => element.id)).toEqual([
			"b",
			"c",
			"a",
			"d",
			"e"
		]);
	});

	it("moves each noncontiguous selected element across one unselected layer", () => {
		expect(reorderSelection(elements, ["a", "c"], "forward").map((element) => element.id)).toEqual([
			"b",
			"a",
			"d",
			"c",
			"e"
		]);
		expect(reorderSelection(elements, ["a", "c"], "backward").map((element) => element.id)).toEqual([
			"a",
			"c",
			"b",
			"d",
			"e"
		]);
	});

	it("reports no move when the selection already occupies its destination", () => {
		expect(canReorderSelection(elements, ["d", "e"], "front")).toBe(false);
		expect(canReorderSelection(elements, ["a", "b"], "back")).toBe(false);
		expect(canReorderSelection(elements, ["e"], "forward")).toBe(false);
		expect(canReorderSelection(elements, ["a"], "backward")).toBe(false);
	});

	it("ignores missing and duplicate IDs", () => {
		expect(reorderSelection(elements, ["missing", "b", "b"], "front").map((element) => element.id)).toEqual([
			"a",
			"c",
			"d",
			"e",
			"b"
		]);
	});
});
