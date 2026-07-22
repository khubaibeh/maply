import { describe, expect, it } from "vitest";

import {
	parseCsv,
	parseTsv,
	detectDelimiter,
	parseDelimited
} from "../../../../src/components/elements-panel/grid/ingest/delimited";

describe("CSV parsing", () => {
	it("parses CSV with comma delimiter", () => {
		const result = parseCsv("a,b,c\nd,e,f");
		expect(result.matrix).toEqual([
			["a", "b", "c"],
			["d", "e", "f"]
		]);
		expect(result.warnings).toEqual([]);
	});

	it("handles quoted CSV fields", () => {
		const result = parseCsv('a,"b,c",d');
		expect(result.matrix).toEqual([["a", "b,c", "d"]]);
	});
});

describe("TSV parsing", () => {
	it("parses TSV with tab delimiter", () => {
		const result = parseTsv("a\tb\tc\nd\te\tf");
		expect(result.matrix).toEqual([
			["a", "b", "c"],
			["d", "e", "f"]
		]);
		expect(result.warnings).toEqual([]);
	});

	it("preserves whitespace in TSV", () => {
		const result = parseTsv("  a  \t b ");
		expect(result.matrix).toEqual([["  a  ", " b "]]);
	});
});

describe("delimiter detection", () => {
	it("detects tab as preferred delimiter", () => {
		const text = "a\tb\tc\nd\te\tf";
		const delimiter = detectDelimiter(text);
		expect(delimiter).toBe("\t");
	});

	it("detects comma as delimiter when no tabs", () => {
		const text = "a,b,c\nd,e,f";
		const delimiter = detectDelimiter(text);
		expect(delimiter).toBe(",");
	});

	it("prefers semicolon over comma in locale-specific data", () => {
		const text = "a;b;c\nd;e;f"; // More semicolons than commas
		const delimiter = detectDelimiter(text);
		expect(delimiter).toBe(";");
	});

	it("defaults to comma for ambiguous data", () => {
		const text = "a\nb\nc";
		const delimiter = detectDelimiter(text);
		expect(delimiter).toBe(",");
	});

	it("analyzes only first 10 lines", () => {
		const lines = Array.from({ length: 15 }, () => "a,b,c").join("\n");
		const delimiter = detectDelimiter(lines);
		expect(delimiter).toBe(",");
	});
});

describe("auto-detect parsing", () => {
	it("parses CSV when commas are present", () => {
		const result = parseDelimited("a,b,c\nd,e,f");
		expect(result.matrix).toEqual([
			["a", "b", "c"],
			["d", "e", "f"]
		]);
	});

	it("parses TSV when tabs are present", () => {
		const result = parseDelimited("a\tb\tc\nd\te\tf");
		expect(result.matrix).toEqual([
			["a", "b", "c"],
			["d", "e", "f"]
		]);
	});

	it("parses semicolon-delimited when present", () => {
		const result = parseDelimited("a;b;c\nd;e;f");
		expect(result.matrix).toEqual([
			["a", "b", "c"],
			["d", "e", "f"]
		]);
	});
});
