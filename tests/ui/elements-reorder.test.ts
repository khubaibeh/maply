import { describe, expect, it } from "vitest";

import { getSelectionRange, projectInsertionIndex, reorderPreview } from "../../src/components/elements-panel/reorder";

describe("elements panel reorder", () => {
	it("converts reversed sidebar indexes to paint-order indexes", () => {
		expect(projectInsertionIndex(5, 0)).toBe(4);
		expect(projectInsertionIndex(5, 4)).toBe(0);
	});

	it("previews a row at its visual insertion index", () => {
		const elements = [{ id: "back" }, { id: "middle" }, { id: "front" }];
		expect(reorderPreview(elements, "back", 1).map((element) => element.id)).toEqual(["front", "back", "middle"]);
	});

	it("extends Shift selection across the visual bounds of a noncontiguous selection", () => {
		const rows = [
			{ id: "text" },
			{ id: "path" },
			{ id: "polygon-2" },
			{ id: "vertical" },
			{ id: "polygon" },
			{ id: "circle" },
			{ id: "horizontal" }
		];

		expect(getSelectionRange(rows, ["vertical", "circle", "horizontal"], "polygon-2").map((row) => row.id)).toEqual(
			["polygon-2", "vertical", "polygon", "circle", "horizontal"]
		);
	});

	it("extends Shift selection across visible rows only", () => {
		const visibleRows = [{ id: "front" }, { id: "matching" }, { id: "back" }];

		expect(getSelectionRange(visibleRows, ["front", "hidden"], "back").map((row) => row.id)).toEqual([
			"front",
			"matching",
			"back"
		]);
	});
});
