import { describe, expect, it } from "vitest";

import {
	addColumn,
	insertRows,
	deleteRows,
	deleteColumns,
	setCell,
	growToFit
} from "../../../src/components/elements-panel/grid/grid-model";

describe("grid mutations", () => {
	describe("addColumn", () => {
		it("adds a new column", () => {
			const headers = ["Name"];
			const rows = [["a"], ["b"]];
			const result = addColumn(headers, rows);
			expect(result.headers).toEqual(["Name", ""]);
			expect(result.rows).toEqual([
				["a", ""],
				["b", ""]
			]);
		});

		it("pads all rows to new width", () => {
			const headers = ["A"];
			const rows = [["a"], ["b"], ["c"]];
			const result = addColumn(headers, rows);
			expect(result.rows.length).toBe(3);
			expect(result.rows.every((row) => row.length === 2)).toBe(true);
		});
	});

	describe("insertRows", () => {
		it("inserts empty rows", () => {
			const headers = ["A", "B"];
			const rows = [["a", "b"]];
			const result = insertRows(headers, rows, 0, 1);
			expect(result.rows.length).toBe(2);
			expect(result.rows[0]).toEqual(["", ""]);
			expect(result.rows[1]).toEqual(["a", "b"]);
		});

		it("inserts multiple rows", () => {
			const headers = ["A"];
			const rows = [["a"]];
			const result = insertRows(headers, rows, 0, 3);
			expect(result.rows.length).toBe(4);
			expect(result.rows.slice(0, 3)).toEqual([[""], [""], [""]]);
		});

		it("maintains rectangularity", () => {
			const headers = ["A", "B", "C"];
			const rows = [["a", "b", "c"]];
			const result = insertRows(headers, rows, 0, 1);
			expect(result.rows.every((row) => row.length === 3)).toBe(true);
		});
	});

	describe("deleteRows", () => {
		it("deletes rows", () => {
			const headers = ["A"];
			const rows = [["a"], ["b"], ["c"]];
			const result = deleteRows(headers, rows, 1, 1);
			expect(result.rows).toEqual([["a"], ["c"]]);
		});

		it("deletes multiple rows", () => {
			const headers = ["A"];
			const rows = [["a"], ["b"], ["c"], ["d"]];
			const result = deleteRows(headers, rows, 1, 2);
			expect(result.rows).toEqual([["a"], ["d"]]);
		});

		it("ensures at least one row remains", () => {
			const headers = ["A"];
			const rows = [["a"]];
			const result = deleteRows(headers, rows, 0, 1);
			expect(result.rows.length).toBeGreaterThanOrEqual(1);
		});
	});

	describe("deleteColumns", () => {
		it("deletes a column", () => {
			const headers = ["A", "B", "C"];
			const rows = [["a", "b", "c"]];
			const result = deleteColumns(headers, rows, new Set([1]));
			expect(result.headers).toEqual(["A", "C"]);
			expect(result.rows).toEqual([["a", "c"]]);
		});

		it("deletes multiple columns", () => {
			const headers = ["A", "B", "C", "D"];
			const rows = [["a", "b", "c", "d"]];
			const result = deleteColumns(headers, rows, new Set([1, 3]));
			expect(result.headers).toEqual(["A", "C"]);
			expect(result.rows).toEqual([["a", "c"]]);
		});

		it("ensures at least one column remains", () => {
			const headers = ["A"];
			const rows = [["a"]];
			const result = deleteColumns(headers, rows, new Set([0]));
			expect(result.headers.length).toBeGreaterThanOrEqual(1);
			expect(result.rows[0]?.length).toBeGreaterThanOrEqual(1);
		});

		it("maintains rectangularity after deletion", () => {
			const headers = ["A", "B", "C"];
			const rows = [["a", "b", "c"]];
			const result = deleteColumns(headers, rows, new Set([1]));
			expect(result.rows.every((row) => row.length === result.headers.length)).toBe(true);
		});
	});

	describe("setCell", () => {
		it("sets cell value immutably", () => {
			const rows = [["a", "b"]];
			const result = setCell(rows, { r: 0, c: 1 }, "X");
			expect(result).toEqual([["a", "X"]]);
			expect(rows).toEqual([["a", "b"]]); // Original unchanged
		});

		it("sets cell in middle of grid", () => {
			const rows = [
				["a", "b", "c"],
				["d", "e", "f"]
			];
			const result = setCell(rows, { r: 1, c: 1 }, "X");
			expect(result[1]![1]).toBe("X");
		});

		it("returns new array instances", () => {
			const rows = [["a", "b"]];
			const result = setCell(rows, { r: 0, c: 0 }, "X");
			expect(result).not.toBe(rows);
			expect(result[0]).not.toBe(rows[0]);
		});
	});

	describe("growToFit", () => {
		it("grows grid to fit target cell", () => {
			const headers = ["A"];
			const rows = [["a"]];
			const result = growToFit(headers, rows, { r: 2, c: 2 });
			expect(result.rows.length).toBeGreaterThanOrEqual(3);
			expect(result.headers.length).toBeGreaterThanOrEqual(3);
		});

		it("maintains rectangularity", () => {
			const headers = ["A"];
			const rows = [["a"]];
			const result = growToFit(headers, rows, { r: 2, c: 2 });
			const width = result.headers.length;
			expect(result.rows.every((row) => row.length === width)).toBe(true);
		});

		it("pads with empty strings", () => {
			const headers = ["A"];
			const rows = [["a"]];
			const result = growToFit(headers, rows, { r: 1, c: 1 });
			expect(result.rows[1]![1]).toBe("");
		});

		it("does not shrink if target is within bounds", () => {
			const headers = ["A", "B", "C"];
			const rows = [["a", "b", "c"]];
			const result = growToFit(headers, rows, { r: 0, c: 0 });
			expect(result.headers.length).toBe(3);
			expect(result.rows.length).toBe(1);
		});
	});

	describe("rectangularity invariant", () => {
		it("maintains after addColumn", () => {
			const headers = ["A"];
			const rows = [["a"], ["b"]];
			const result = addColumn(headers, rows);
			const width = result.headers.length;
			expect(result.rows.every((row) => row.length === width)).toBe(true);
		});

		it("maintains after insertRows", () => {
			const headers = ["A", "B"];
			const rows = [["a", "b"]];
			const result = insertRows(headers, rows, 0, 1);
			const width = result.headers.length;
			expect(result.rows.every((row) => row.length === width)).toBe(true);
		});

		it("maintains after deleteRows", () => {
			const headers = ["A", "B"];
			const rows = [
				["a", "b"],
				["c", "d"]
			];
			const result = deleteRows(headers, rows, 0, 1);
			const width = result.headers.length;
			expect(result.rows.every((row) => row.length === width)).toBe(true);
		});

		it("maintains after deleteColumns", () => {
			const headers = ["A", "B", "C"];
			const rows = [["a", "b", "c"]];
			const result = deleteColumns(headers, rows, new Set([1]));
			const width = result.headers.length;
			expect(result.rows.every((row) => row.length === width)).toBe(true);
		});
	});
});
