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

function gridWithRows(rowCount: number) {
	const grid = createGrid();
	grid.rows = Array.from({ length: rowCount }, (_, index) => [index === rowCount - 1 ? "" : `row-${index}`]);
	return grid;
}

describe("grid defaults", () => {
	it("starts with one row", () => {
		expect(createGrid().rows).toHaveLength(1);
	});

	it("hydrates and persists grid data", () => {
		const changes: { headers: string[]; rows: string[][] }[] = [];
		const grid = createGrid({
			data: { headers: ["Name"], rows: [["Alpha"], [""]] },
			onChange: (data) => changes.push(data)
		});

		grid.setEditing({ r: 0, c: 0 });
		grid.commitEdit("Beta");

		expect(grid.rows).toEqual([["Beta"], [""]]);
		expect(changes).toEqual([{ headers: ["Name"], rows: [["Beta"], [""]] }]);
	});
});

describe("blank name row", () => {
	it("adds a new blank bucket after naming the current blank row", () => {
		const grid = createGrid();
		grid.setEditing({ r: 0, c: 0 });

		grid.commitEdit("Alpha");

		expect(grid.rows).toEqual([["Alpha"], [""]]);
	});

	it("removes a row committed blank when a blank bucket already exists", () => {
		const grid = createGrid();
		grid.rows = [["Alpha"], [""]];
		grid.moveTo({ r: 0, c: 0 });
		grid.setEditing({ r: 0, c: 0 });

		grid.commitEdit("");

		expect(grid.rows).toEqual([[""]]);
		expect(grid.active).toEqual({ r: 0, c: 0 });
	});

	it("does not add another row while the blank bucket exists", () => {
		const grid = createGrid();

		grid.addNewRow();

		expect(grid.rows).toEqual([[""]]);
	});
});

describe("grid cell selection", () => {
	it("selects a rectangular range by extending from the active cell", () => {
		const grid = gridWithRows(3);
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
		const grid = gridWithRows(3);

		grid.startCellSelection({ r: 1, c: 0 }, false);
		grid.startCellSelection({ r: 2, c: 0 }, true);

		expect(grid.selection).toEqual({
			anchor: { r: 1, c: 0 },
			focus: { r: 2, c: 0 }
		});
	});
});

describe("grid filters", () => {
	it("clears selections and moves focus when an applied filter hides the active row", () => {
		const grid = gridWithRows(3);
		grid.moveTo({ r: 1, c: 0 });
		grid.startCellSelection({ r: 1, c: 0 }, false);
		grid.applyFilter(0, new Set(["row-0"]));
		grid.setVisibleRows([0, 2]);

		expect(grid.active).toEqual({ r: 0, c: 0 });
		expect(grid.selection).toBeNull();
		expect(grid.hasFilters).toBe(true);
	});

	it("clears every applied filter", () => {
		const grid = createGrid();
		grid.applyFilter(0, new Set(["Alpha"]));

		grid.clearFilters();

		expect(grid.hasFilters).toBe(false);
	});

	it("clears filters when deleting columns", () => {
		const grid = createGrid();
		grid.addNewColumn();
		grid.applyFilter(0, new Set(["Alpha"]));
		grid.startColumnSelection(1, false, false);

		grid.deleteSelected();

		expect(grid.hasFilters).toBe(false);
	});
});

describe("grid sorting", () => {
	it("cycles a column through ascending, descending, and unsorted", () => {
		const grid = createGrid();

		grid.toggleSort(0);
		expect(grid.sort).toEqual({ column: 0, direction: "ascending" });

		grid.toggleSort(0);
		expect(grid.sort).toEqual({ column: 0, direction: "descending" });

		grid.toggleSort(0);
		expect(grid.sort).toBeNull();
	});

	it("starts a new column sort in ascending order", () => {
		const grid = createGrid();
		grid.addNewColumn();
		grid.toggleSort(0);

		grid.toggleSort(1);

		expect(grid.sort).toEqual({ column: 1, direction: "ascending" });
	});
});

describe("grid row selection", () => {
	it("selects each row crossed by a gutter drag", () => {
		const grid = gridWithRows(5);

		grid.startRowSelection(1, false, false);
		grid.extendRowSelection(4);

		expect(grid.headerSel?.kind).toBe("row");
		expect(grid.headerSel?.indices).toEqual(new Set([1, 2, 3, 4]));
	});

	it("selects upward from the pressed row", () => {
		const grid = gridWithRows(5);

		grid.startRowSelection(3, false, false);
		grid.extendRowSelection(1);

		expect(grid.headerSel?.indices).toEqual(new Set([1, 2, 3]));
	});
});

describe("grid column selection", () => {
	it("selects each column crossed by a header drag", () => {
		const grid = gridWithRows(3);
		grid.addNewColumn();
		grid.addNewColumn();
		grid.addNewColumn();

		grid.startColumnSelection(0, false, false);
		grid.extendColumnSelection(3);

		expect(grid.headerSel?.kind).toBe("col");
		expect(grid.headerSel?.indices).toEqual(new Set([0, 1, 2, 3]));
	});

	it("selects leftward from the pressed column", () => {
		const grid = gridWithRows(3);
		grid.addNewColumn();
		grid.addNewColumn();

		grid.startColumnSelection(2, false, false);
		grid.extendColumnSelection(0);

		expect(grid.headerSel?.indices).toEqual(new Set([0, 1, 2]));
	});
});

describe("grid keyboard editing", () => {
	it("commits an edit without moving the active cell", () => {
		const grid = gridWithRows(3);
		grid.moveTo({ r: 1, c: 0 });
		grid.setEditing({ r: 1, c: 0 });
		const input = Object.assign(new EventTarget(), { value: "Updated" });

		grid.handleKeydown(keyEvent("Enter", input));

		expect(grid.rows[1][0]).toBe("Updated");
		expect(grid.active).toEqual({ r: 1, c: 0 });
	});

	it("starts editing when Enter is pressed on an active cell", () => {
		const grid = gridWithRows(3);
		grid.moveTo({ r: 1, c: 0 });

		grid.handleKeydown(keyEvent("Enter"));

		expect(grid.rows).toHaveLength(3);
		expect(grid.active).toEqual({ r: 1, c: 0 });
		expect(grid.editing).toEqual({ r: 1, c: 0 });
	});

	it("cancels an edit without changing the cell when Escape is pressed", () => {
		const grid = gridWithRows(3);
		grid.moveTo({ r: 1, c: 0 });
		grid.setEditing({ r: 1, c: 0 });

		grid.handleKeydown(keyEvent("Escape"));

		expect(grid.rows[1][0]).toBe("row-1");
		expect(grid.editing).toBeNull();
	});

	it("discards the initial character when an edit started from a blank cell is cancelled", () => {
		const grid = createGrid();

		grid.handleKeydown(keyEvent("A"));
		grid.handleKeydown(keyEvent("Escape"));

		expect(grid.rows).toEqual([[""]]);
		expect(grid.editing).toBeNull();
	});

	it("continues navigation after cancelling an edit", () => {
		const grid = gridWithRows(3);
		grid.moveTo({ r: 1, c: 0 });
		grid.setEditing({ r: 1, c: 0 });
		grid.handleKeydown(keyEvent("Escape"));

		grid.handleKeydown(keyEvent("ArrowDown"));

		expect(grid.active).toEqual({ r: 2, c: 0 });
	});

	it("moves to the next visible row when Tab commits an edit", () => {
		const grid = gridWithRows(4);
		grid.applyFilter(0, new Set(["row-0", "row-2"]));
		grid.setVisibleRows([0, 2, 3]);
		grid.moveTo({ r: 0, c: 0 });
		grid.setEditing({ r: 0, c: 0 });
		const input = Object.assign(new EventTarget(), { value: "row-0" });

		grid.handleKeydown(keyEvent("Tab", input));

		expect(grid.active).toEqual({ r: 2, c: 0 });
	});

	it("moves through visible rows after committing an edit", () => {
		const grid = gridWithRows(4);
		grid.applyFilter(0, new Set(["row-0", "row-2"]));
		grid.setVisibleRows([0, 2, 3]);
		grid.moveTo({ r: 0, c: 0 });
		grid.setEditing({ r: 0, c: 0 });
		grid.commitEdit("row-0");

		grid.handleKeydown(keyEvent("ArrowDown"));

		expect(grid.active).toEqual({ r: 2, c: 0 });
	});

	it("requests focus when a committed value is removed by an active filter", () => {
		const grid = gridWithRows(3);
		grid.applyFilter(0, new Set(["row-0"]));
		grid.setVisibleRows([0, 2]);
		grid.moveTo({ r: 0, c: 0 });
		grid.setEditing({ r: 0, c: 0 });

		grid.commitEdit("hidden");
		grid.setVisibleRows([2]);

		expect(grid.active).toEqual({ r: 2, c: 0 });
		expect(grid.takeFocusAfterCommit()).toBe(true);
	});

	it("keeps focus on the trailing blank row when Arrow Down is pressed", () => {
		const grid = gridWithRows(3);
		grid.moveTo({ r: 2, c: 0 });

		grid.handleKeydown(keyEvent("ArrowDown"));

		expect(grid.rows).toHaveLength(3);
		expect(grid.active).toEqual({ r: 2, c: 0 });
	});
});
