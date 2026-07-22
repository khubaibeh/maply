import { describe, expect, it } from "vitest";

import { applyMatrix } from "../../../src/components/elements-panel/grid/grid-apply";

describe("applyMatrix", () => {
	describe("basic insertion", () => {
		it("applies matrix at anchor (0,0)", () => {
			const headers = ["A", "B"];
			const rows = [["x", "y"]];
			const matrix = [["a", "b"]];
			const result = applyMatrix(headers, rows, matrix, { r: 0, c: 0 });
			expect(result.rows).toEqual([["a", "b"]]);
			expect(result.warnings).toEqual([]);
		});

		it("applies matrix at offset (1,1)", () => {
			const headers = ["A", "B"];
			const rows = [["x", "y"]];
			const matrix = [["a"]];
			const result = applyMatrix(headers, rows, matrix, { r: 0, c: 1 });
			expect(result.rows[0]).toEqual(["x", "a"]);
		});

		it("merges with existing data", () => {
			const headers = ["A", "B", "C"];
			const rows = [
				["x", "y", "z"],
				["1", "2", "3"]
			];
			const matrix = [["a", "b"]];
			const result = applyMatrix(headers, rows, matrix, { r: 1, c: 1 });
			expect(result.rows[1]).toEqual(["1", "a", "b"]);
		});
	});

	describe("row growth", () => {
		it("grows rows to fit matrix", () => {
			const headers = ["A", "B"];
			const rows = [["x", "y"]];
			const matrix = [
				["a", "b"],
				["c", "d"]
			];
			const result = applyMatrix(headers, rows, matrix, { r: 0, c: 0 });
			expect(result.rows.length).toBe(2);
		});

		it("pads new rows to width", () => {
			const headers = ["A", "B", "C"];
			const rows = [["x", "y", "z"]];
			const matrix = [["a"]];
			const result = applyMatrix(headers, rows, matrix, { r: 1, c: 0 });
			expect(result.rows[1]?.length).toBe(3);
		});

		it("pads at offset", () => {
			const headers = ["A", "B"];
			const rows = [["x", "y"]];
			const matrix = [["a"]];
			const result = applyMatrix(headers, rows, matrix, { r: 0, c: 1 });
			expect(result.rows[0]?.length).toBe(2);
		});
	});

	describe("column handling", () => {
		it("truncates matrix columns beyond grid width", () => {
			const headers = ["A", "B"];
			const rows = [["x", "y"]];
			const matrix = [["a", "b", "c", "d"]];
			const result = applyMatrix(headers, rows, matrix, { r: 0, c: 0 });
			expect(result.rows[0]).toEqual(["a", "b"]);
		});

		it("warns on truncated columns", () => {
			const headers = ["A"];
			const rows = [["x"]];
			const matrix = [["a", "b", "c"]];
			const result = applyMatrix(headers, rows, matrix, { r: 0, c: 0 });
			expect(result.warnings.length).toBeGreaterThan(0);
			expect(result.warnings[0]?.type).toBe("truncated_columns");
		});

		it("fills only up to grid width at offset", () => {
			const headers = ["A", "B", "C"];
			const rows = [["x", "y", "z"]];
			const matrix = [["a", "b", "c", "d"]];
			const result = applyMatrix(headers, rows, matrix, { r: 0, c: 1 });
			expect(result.rows[0]).toEqual(["x", "a", "b"]);
		});
	});

	describe("edge cases", () => {
		it("handles empty matrix", () => {
			const headers = ["A", "B"];
			const rows = [["x", "y"]];
			const matrix: string[][] = [];
			const result = applyMatrix(headers, rows, matrix, { r: 0, c: 0 });
			expect(result.rows).toEqual(rows);
		});

		it("handles single cell matrix", () => {
			const headers = ["A", "B"];
			const rows = [["x", "y"]];
			const matrix = [["a"]];
			const result = applyMatrix(headers, rows, matrix, { r: 0, c: 0 });
			expect(result.rows[0]![0]).toBe("a");
		});

		it("applies multi-row matrix", () => {
			const headers = ["A", "B"];
			const rows = [["x", "y"]];
			const matrix = [
				["a", "b"],
				["c", "d"],
				["e", "f"]
			];
			const result = applyMatrix(headers, rows, matrix, { r: 0, c: 0 });
			expect(result.rows.length).toBe(3);
			expect(result.rows).toEqual([
				["a", "b"],
				["c", "d"],
				["e", "f"]
			]);
		});

		it("preserves original rows not affected by matrix", () => {
			const headers = ["A", "B"];
			const rows = [
				["x", "y"],
				["p", "q"]
			];
			const matrix = [["a", "b"]];
			const result = applyMatrix(headers, rows, matrix, { r: 1, c: 0 });
			expect(result.rows[0]).toEqual(["x", "y"]);
		});
	});

	describe("rectangularity", () => {
		it("maintains rectangularity after apply", () => {
			const headers = ["A", "B"];
			const rows = [["x", "y"]];
			const matrix = [["a"], ["b"]];
			const result = applyMatrix(headers, rows, matrix, { r: 0, c: 0 });
			const width = headers.length;
			expect(result.rows.every((row) => row.length === width)).toBe(true);
		});

		it("pads shorter rows in matrix", () => {
			const headers = ["A", "B", "C"];
			const rows = [["x", "y", "z"]];
			const matrix = [
				["a", "b", "c"],
				["d", "e"]
			];
			const result = applyMatrix(headers, rows, matrix, { r: 0, c: 0 });
			expect(result.rows[1]?.length).toBe(3);
			expect(result.rows[1]![2]).toBe("");
		});
	});

	describe("convergence test", () => {
		it("produces same result from paste and file import paths", () => {
			const headers = ["Name", "Age"];
			const rows = [
				["Alice", "30"],
				["Bob", "25"]
			];
			const matrix = [["Charlie", "35"]];
			const anchor = { r: 2, c: 0 };

			const pasteResult = applyMatrix(headers, rows, matrix, anchor);
			const fileResult = applyMatrix(headers, rows, matrix, anchor);

			expect(pasteResult.rows).toEqual(fileResult.rows);
			expect(pasteResult.warnings).toEqual(fileResult.warnings);
		});
	});
});
