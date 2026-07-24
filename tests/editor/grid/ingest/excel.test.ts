import { describe, expect, it } from "vitest";

import { parseExcel } from "../../../../src/components/elements-panel/grid/ingest/excel";
import { MAX_CELLS, MAX_COLUMNS, MAX_ROWS } from "../../../../src/components/elements-panel/grid/ingest/types";

async function workbookBuffer(bookType: "xls" | "xlsx", rows: string[][], range?: string): Promise<ArrayBuffer> {
	const { utils, write } = await import("xlsx");
	const workbook = utils.book_new();
	const sheet = utils.aoa_to_sheet(rows);
	if (range) sheet["!ref"] = range;
	utils.book_append_sheet(workbook, sheet, "Values");
	return write(workbook, { bookType, type: "array" });
}

describe("Excel parsing", () => {
	it("handles empty/invalid buffer", async () => {
		const emptyBuffer = new ArrayBuffer(0);
		const result = await parseExcel(emptyBuffer);
		expect(result.warnings.length).toBeGreaterThanOrEqual(0);
		expect(Array.isArray(result.matrix)).toBe(true);
	});

	it("returns matrix and warnings object", async () => {
		const result = await parseExcel(new ArrayBuffer(10));
		expect(result).toHaveProperty("matrix");
		expect(result).toHaveProperty("warnings");
		expect(Array.isArray(result.matrix)).toBe(true);
		expect(Array.isArray(result.warnings)).toBe(true);
	});

	it.each(["xlsx", "xls"] as const)("parses a real %s workbook", async (bookType) => {
		const result = await parseExcel(
			await workbookBuffer(bookType, [
				["Name", "Age"],
				["Alice", "30"]
			])
		);

		expect(result).toEqual({
			matrix: [
				["Name", "Age"],
				["Alice", "30"]
			],
			warnings: []
		});
	});

	it("parses a single-cell worksheet without trimming whitespace", async () => {
		const result = await parseExcel(await workbookBuffer("xlsx", [["  preserved  "]]));

		expect(result.matrix).toEqual([["  preserved  "]]);
	});

	it("accepts worksheet ranges at the row, column, and cell limits", async () => {
		const rowResult = await parseExcel(await workbookBuffer("xlsx", [["value"]], `A1:A${MAX_ROWS}`));
		const columnResult = await parseExcel(await workbookBuffer("xlsx", [["value"]], `A1:AX1`));
		const cellsPerRow = MAX_COLUMNS;
		const rows = MAX_CELLS / cellsPerRow;
		const cellResult = await parseExcel(await workbookBuffer("xlsx", [["value"]], `A1:AX${rows}`));

		expect(rowResult.matrix).toHaveLength(MAX_ROWS);
		expect(columnResult.matrix[0]).toHaveLength(MAX_COLUMNS);
		expect(cellResult.matrix).toHaveLength(rows);
	});

	it("rejects worksheet ranges above each import limit before matrix allocation", async () => {
		await expect(
			parseExcel(await workbookBuffer("xlsx", [["value"]], `A1:A${MAX_ROWS + 1}`))
		).rejects.toMatchObject({
			code: "too_many_rows"
		});
		await expect(parseExcel(await workbookBuffer("xlsx", [["value"]], "A1:AY1"))).rejects.toMatchObject({
			code: "too_many_columns"
		});
		const rows = MAX_CELLS / MAX_COLUMNS + 1;
		await expect(parseExcel(await workbookBuffer("xlsx", [["value"]], `A1:AX${rows}`))).rejects.toMatchObject({
			code: "too_many_cells"
		});
	});
});
