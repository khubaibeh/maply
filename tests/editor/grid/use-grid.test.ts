import { describe, expect, it } from "vitest";

import { createGrid } from "../../../src/components/elements-panel/grid/use-grid.svelte";

function keyEvent(key: string, target: EventTarget | null = null) {
	return {
		key,
		shiftKey: false,
		ctrlKey: false,
		metaKey: false,
		target,
		preventDefault() {}
	};
}

describe("grid cell selection", () => {
	it("selects a rectangular range by extending from the active cell", () => {
		const grid = createGrid(3);
		grid.addNewColumn();

		grid.startCellSelection({ r: 0, c: 0 }, false);
		grid.extendCellSelection({ r: 2, c: 1 });

		expect(grid.active).toEqual({ r: 0, c: 0 });
		expect(grid.selection).toEqual({
			anchor: { r: 0, c: 0 },
			focus: { r: 2, c: 1 }
		});
		expect(grid.selectedCellStatus({ r: 1, c: 1 })).toBe("selected");
	});

	it("extends a selection from the current anchor", () => {
		const grid = createGrid(3);

		grid.startCellSelection({ r: 1, c: 0 }, false);
		grid.startCellSelection({ r: 2, c: 0 }, true);

		expect(grid.selection).toEqual({
			anchor: { r: 1, c: 0 },
			focus: { r: 2, c: 0 }
		});
	});
});

describe("grid row selection", () => {
	it("selects each row crossed by a gutter drag", () => {
		const grid = createGrid(5);

		grid.startRowSelection(1, false, false);
		grid.extendRowSelection(4);

		expect(grid.headerSel?.kind).toBe("row");
		expect(grid.headerSel?.indices).toEqual(new Set([1, 2, 3, 4]));
	});

	it("selects upward from the pressed row", () => {
		const grid = createGrid(5);

		grid.startRowSelection(3, false, false);
		grid.extendRowSelection(1);

		expect(grid.headerSel?.indices).toEqual(new Set([1, 2, 3]));
	});
});

describe("grid column selection", () => {
	it("selects each column crossed by a header drag", () => {
		const grid = createGrid(3);
		grid.addNewColumn();
		grid.addNewColumn();
		grid.addNewColumn();

		grid.startColumnSelection(0, false, false);
		grid.extendColumnSelection(3);

		expect(grid.headerSel?.kind).toBe("col");
		expect(grid.headerSel?.indices).toEqual(new Set([0, 1, 2, 3]));
	});

	it("selects leftward from the pressed column", () => {
		const grid = createGrid(3);
		grid.addNewColumn();
		grid.addNewColumn();

		grid.startColumnSelection(2, false, false);
		grid.extendColumnSelection(0);

		expect(grid.headerSel?.indices).toEqual(new Set([0, 1, 2]));
	});
});

describe("grid keyboard editing", () => {
	it("commits an edit without moving the active cell", () => {
		const grid = createGrid(3);
		grid.moveTo({ r: 1, c: 0 });
		grid.setEditing({ r: 1, c: 0 });
		const input = Object.assign(new EventTarget(), { value: "Updated" });

		grid.handleKeydown(keyEvent("Enter", input));

		expect(grid.rows[1][0]).toBe("Updated");
		expect(grid.active).toEqual({ r: 1, c: 0 });
	});

	it("starts editing when Enter is pressed on an active cell", () => {
		const grid = createGrid(3);
		grid.moveTo({ r: 1, c: 0 });

		grid.handleKeydown(keyEvent("Enter"));

		expect(grid.rows).toHaveLength(3);
		expect(grid.active).toEqual({ r: 1, c: 0 });
		expect(grid.editing).toEqual({ r: 1, c: 0 });
	});

	it("adds a row when Arrow Down is pressed on the last row", () => {
		const grid = createGrid(3);
		grid.moveTo({ r: 2, c: 0 });

		grid.handleKeydown(keyEvent("ArrowDown"));

		expect(grid.rows).toHaveLength(4);
		expect(grid.active).toEqual({ r: 3, c: 0 });
	});
});
