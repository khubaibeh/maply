import { describe, expect, it } from "vitest";

import { navigate, type GridDimensions } from "../../../src/components/elements-panel/grid/grid-navigation";

describe("grid navigation", () => {
	const dims: GridDimensions = { rows: 10, cols: 10 };

	describe("arrow keys", () => {
		it("moves up", () => {
			const result = navigate({ r: 5, c: 5 }, "ArrowUp", dims, false);
			expect(result.next).toEqual({ r: 4, c: 5 });
			expect(result.needsNewRow).toBe(false);
		});

		it("clamps up at top", () => {
			const result = navigate({ r: 0, c: 5 }, "ArrowUp", dims, false);
			expect(result.next).toEqual({ r: 0, c: 5 });
		});

		it("moves down", () => {
			const result = navigate({ r: 5, c: 5 }, "ArrowDown", dims, false);
			expect(result.next).toEqual({ r: 6, c: 5 });
			expect(result.needsNewRow).toBe(false);
		});

		it("clamps down at bottom", () => {
			const result = navigate({ r: 9, c: 5 }, "ArrowDown", dims, false);
			expect(result.next).toEqual({ r: 9, c: 5 });
		});

		it("moves left", () => {
			const result = navigate({ r: 5, c: 5 }, "ArrowLeft", dims, false);
			expect(result.next).toEqual({ r: 5, c: 4 });
		});

		it("clamps left at start", () => {
			const result = navigate({ r: 5, c: 0 }, "ArrowLeft", dims, false);
			expect(result.next).toEqual({ r: 5, c: 0 });
		});

		it("moves right", () => {
			const result = navigate({ r: 5, c: 5 }, "ArrowRight", dims, false);
			expect(result.next).toEqual({ r: 5, c: 6 });
		});

		it("clamps right at end", () => {
			const result = navigate({ r: 5, c: 9 }, "ArrowRight", dims, false);
			expect(result.next).toEqual({ r: 5, c: 9 });
		});
	});

	describe("Tab navigation", () => {
		it("moves right", () => {
			const result = navigate({ r: 5, c: 5 }, "Tab", dims, false);
			expect(result.next).toEqual({ r: 5, c: 6 });
			expect(result.needsNewRow).toBe(false);
		});

		it("wraps to next row when at end of row", () => {
			const result = navigate({ r: 5, c: 9 }, "Tab", dims, false);
			expect(result.next).toEqual({ r: 6, c: 0 });
		});

		it("signals needsNewRow at end of grid", () => {
			const result = navigate({ r: 9, c: 9 }, "Tab", dims, false);
			expect(result.needsNewRow).toBe(true);
		});

		it("Shift+Tab moves left", () => {
			const result = navigate({ r: 5, c: 5 }, "Tab", dims, true);
			expect(result.next).toEqual({ r: 5, c: 4 });
		});

		it("Shift+Tab wraps to prev row at start", () => {
			const result = navigate({ r: 5, c: 0 }, "Tab", dims, true);
			expect(result.next).toEqual({ r: 4, c: 9 });
		});

		it("Shift+Tab does not wrap above first row", () => {
			const result = navigate({ r: 0, c: 0 }, "Tab", dims, true);
			expect(result.next).toEqual({ r: 0, c: 0 });
		});
	});

	describe("Enter navigation", () => {
		it("moves down", () => {
			const result = navigate({ r: 5, c: 5 }, "Enter", dims, false);
			expect(result.next).toEqual({ r: 6, c: 5 });
			expect(result.needsNewRow).toBe(false);
		});

		it("signals needsNewRow at last row", () => {
			const result = navigate({ r: 9, c: 5 }, "Enter", dims, false);
			expect(result.needsNewRow).toBe(true);
		});

		it("Shift+Enter moves up", () => {
			const result = navigate({ r: 5, c: 5 }, "Enter", dims, true);
			expect(result.next).toEqual({ r: 4, c: 5 });
		});

		it("Shift+Enter clamps at top", () => {
			const result = navigate({ r: 0, c: 5 }, "Enter", dims, true);
			expect(result.next).toEqual({ r: 0, c: 5 });
		});
	});

	describe("single row edge case", () => {
		const singleRowDims: GridDimensions = { rows: 1, cols: 10 };

		it("Tab at end of single row signals needsNewRow", () => {
			const result = navigate({ r: 0, c: 9 }, "Tab", singleRowDims, false);
			expect(result.needsNewRow).toBe(true);
		});

		it("Enter at end of single row signals needsNewRow", () => {
			const result = navigate({ r: 0, c: 5 }, "Enter", singleRowDims, false);
			expect(result.needsNewRow).toBe(true);
		});
	});

	describe("single column edge case", () => {
		const singleColDims: GridDimensions = { rows: 10, cols: 1 };

		it("Tab wraps within single column", () => {
			const result = navigate({ r: 0, c: 0 }, "Tab", singleColDims, false);
			expect(result.next).toEqual({ r: 1, c: 0 });
		});

		it("Arrow left clamps", () => {
			const result = navigate({ r: 5, c: 0 }, "ArrowLeft", singleColDims, false);
			expect(result.next).toEqual({ r: 5, c: 0 });
		});

		it("Arrow right clamps", () => {
			const result = navigate({ r: 5, c: 0 }, "ArrowRight", singleColDims, false);
			expect(result.next).toEqual({ r: 5, c: 0 });
		});
	});

	describe("1x1 grid", () => {
		const singleCellDims: GridDimensions = { rows: 1, cols: 1 };

		it("Tab signals needsNewRow", () => {
			const result = navigate({ r: 0, c: 0 }, "Tab", singleCellDims, false);
			expect(result.needsNewRow).toBe(true);
		});

		it("Enter signals needsNewRow", () => {
			const result = navigate({ r: 0, c: 0 }, "Enter", singleCellDims, false);
			expect(result.needsNewRow).toBe(true);
		});

		it("arrows clamp", () => {
			expect(navigate({ r: 0, c: 0 }, "ArrowUp", singleCellDims, false).next).toEqual({ r: 0, c: 0 });
			expect(navigate({ r: 0, c: 0 }, "ArrowDown", singleCellDims, false).next).toEqual({ r: 0, c: 0 });
			expect(navigate({ r: 0, c: 0 }, "ArrowLeft", singleCellDims, false).next).toEqual({ r: 0, c: 0 });
			expect(navigate({ r: 0, c: 0 }, "ArrowRight", singleCellDims, false).next).toEqual({ r: 0, c: 0 });
		});
	});
});
