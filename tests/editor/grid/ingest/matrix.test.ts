import { describe, expect, it } from "vitest";

import {
	parseDelimitedMatrix,
	escapeDelimitedCell
} from "../../../../src/components/elements-panel/grid/ingest/matrix";
import { MAX_CELLS, MAX_COLUMNS, MAX_ROWS } from "../../../../src/components/elements-panel/grid/ingest/types";

describe("matrix parsing", () => {
	it("parses simple comma-delimited values", () => {
		const result = parseDelimitedMatrix("a,b,c", ",");
		expect(result).toEqual([["a", "b", "c"]]);
	});

	it("parses tab-delimited values", () => {
		const result = parseDelimitedMatrix("a\tb\tc", "\t");
		expect(result).toEqual([["a", "b", "c"]]);
	});

	it("parses multiple rows", () => {
		const result = parseDelimitedMatrix("a,b\nc,d", ",");
		expect(result).toEqual([
			["a", "b"],
			["c", "d"]
		]);
	});

	it("handles quoted fields with embedded delimiters", () => {
		const result = parseDelimitedMatrix('a,"b,c",d', ",");
		expect(result).toEqual([["a", "b,c", "d"]]);
	});

	it("handles quoted fields with embedded newlines", () => {
		const result = parseDelimitedMatrix('a,"b\nc",d', ",");
		expect(result).toEqual([["a", "b\nc", "d"]]);
	});

	it("handles RFC 4180 double-quote escaping", () => {
		const result = parseDelimitedMatrix('a,"b""c",d', ",");
		expect(result).toEqual([["a", 'b"c', "d"]]);
	});

	it("rectangularizes uneven rows with empty strings", () => {
		const result = parseDelimitedMatrix("a,b,c\nd,e", ",");
		expect(result).toEqual([
			["a", "b", "c"],
			["d", "e", ""]
		]);
	});

	it("strips trailing newline", () => {
		const result = parseDelimitedMatrix("a,b\nc,d\n", ",");
		expect(result).toEqual([
			["a", "b"],
			["c", "d"]
		]);
	});

	it("handles \\r\\n line endings", () => {
		const result = parseDelimitedMatrix("a,b\r\nc,d", ",");
		expect(result).toEqual([
			["a", "b"],
			["c", "d"]
		]);
	});

	it("handles trailing \\r\\n correctly", () => {
		const result = parseDelimitedMatrix("a,b\r\nc,d\r\n", ",");
		expect(result).toEqual([
			["a", "b"],
			["c", "d"]
		]);
	});

	it("handles empty cells", () => {
		const result = parseDelimitedMatrix("a,,c", ",");
		expect(result).toEqual([["a", "", "c"]]);
	});

	it("handles quoted empty cells", () => {
		const result = parseDelimitedMatrix('a,"",c', ",");
		expect(result).toEqual([["a", "", "c"]]);
	});

	it("does not trim cells", () => {
		const result = parseDelimitedMatrix("  a  , b ", ",");
		expect(result).toEqual([["  a  ", " b "]]);
	});

	it("escapes cells with delimiters", () => {
		const result = escapeDelimitedCell("a,b", ",");
		expect(result).toBe('"a,b"');
	});

	it("escapes cells with quotes", () => {
		const result = escapeDelimitedCell('a"b', ",");
		expect(result).toBe('"a""b"');
	});

	it("escapes cells with newlines", () => {
		const result = escapeDelimitedCell("a\nb", ",");
		expect(result).toBe('"a\nb"');
	});

	it("does not escape cells without special chars", () => {
		const result = escapeDelimitedCell("abc", ",");
		expect(result).toBe("abc");
	});

	it("handles complex quoted field", () => {
		const result = parseDelimitedMatrix('"a""b""c"', ",");
		expect(result).toEqual([['a"b"c']]);
	});

	it("rejects unterminated quoted fields", () => {
		expect(() => parseDelimitedMatrix('a,"unterminated', ",")).toThrow("unterminated");
	});

	it("rejects a quote that starts in the middle of a field", () => {
		expect(() => parseDelimitedMatrix('a"b,c', ",")).toThrow("start of a field");
	});

	it("handles empty input", () => {
		const result = parseDelimitedMatrix("", ",");
		expect(result).toEqual([[""]]);
	});

	it("handles single cell", () => {
		const result = parseDelimitedMatrix("hello", ",");
		expect(result).toEqual([["hello"]]);
	});

	it("handles multiple rows with different delimiters", () => {
		const result = parseDelimitedMatrix("a;b;c\nd;e;f", ";");
		expect(result).toEqual([
			["a", "b", "c"],
			["d", "e", "f"]
		]);
	});

	it("accepts exactly the maximum row count", () => {
		const input = Array.from({ length: MAX_ROWS }, () => "value").join("\n");
		expect(parseDelimitedMatrix(input, ",")).toHaveLength(MAX_ROWS);
	});

	it("rejects more than the maximum row count", () => {
		const input = Array.from({ length: MAX_ROWS + 1 }, () => "value").join("\n");
		expect(() => parseDelimitedMatrix(input, ",")).toThrow("at most");
	});

	it("accepts exactly the maximum column count", () => {
		const input = Array.from({ length: MAX_COLUMNS }, () => "value").join(",");
		expect(parseDelimitedMatrix(input, ",")[0]).toHaveLength(MAX_COLUMNS);
	});

	it("rejects more than the maximum column count", () => {
		const input = Array.from({ length: MAX_COLUMNS + 1 }, () => "value").join(",");
		expect(() => parseDelimitedMatrix(input, ",")).toThrow("at most");
	});

	it("accepts exactly the maximum cell count", () => {
		const columns = 40;
		const rows = MAX_CELLS / columns;
		const input = Array.from({ length: rows }, () => Array.from({ length: columns }, () => "v").join(",")).join(
			"\n"
		);
		expect(parseDelimitedMatrix(input, ",")).toHaveLength(rows);
	});

	it("rejects more than the maximum cell count", () => {
		const columns = 40;
		const rows = MAX_CELLS / columns + 1;
		const input = Array.from({ length: rows }, () => Array.from({ length: columns }, () => "v").join(",")).join(
			"\n"
		);
		expect(() => parseDelimitedMatrix(input, ",")).toThrow("at most");
	});

	it("rejects ragged input whose rectangular form exceeds the cell limit", () => {
		const wideRow = Array.from({ length: MAX_COLUMNS }, () => "value").join(",");
		const narrowRows = Array.from({ length: MAX_ROWS - 1 }, () => "value").join("\n");

		expect(() => parseDelimitedMatrix(`${wideRow}\n${narrowRows}`, ",")).toThrow("at most");
	});
});
