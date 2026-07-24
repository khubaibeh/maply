import { describe, expect, it } from "vitest";

import { parseClipboard, serializeGridRange } from "../../../../src/components/elements-panel/grid/ingest/clipboard";

describe("clipboard parsing", () => {
	it("parses tab-separated values", () => {
		const result = parseClipboard("a\tb\tc");
		expect(result.matrix).toEqual([["a", "b", "c"]]);
	});

	it("parses multi-row clipboard content", () => {
		const result = parseClipboard("a\tb\nc\td");
		expect(result.matrix).toEqual([
			["a", "b"],
			["c", "d"]
		]);
	});

	it("handles \\r\\n line endings (Windows clipboard)", () => {
		const result = parseClipboard("a\tb\r\nc\td");
		expect(result.matrix).toEqual([
			["a", "b"],
			["c", "d"]
		]);
	});

	it("does not trim cells", () => {
		const result = parseClipboard("  a  \t b ");
		expect(result.matrix).toEqual([["  a  ", " b "]]);
	});

	it("preserves empty cells", () => {
		const result = parseClipboard("a\t\tc");
		expect(result.matrix).toEqual([["a", "", "c"]]);
	});

	it("handles trailing newline", () => {
		const result = parseClipboard("a\tb\n");
		expect(result.matrix).toEqual([["a", "b"]]);
	});

	it("rectangularizes uneven rows", () => {
		const result = parseClipboard("a\tb\tc\nd\te");
		expect(result.matrix).toEqual([
			["a", "b", "c"],
			["d", "e", ""]
		]);
	});
});

describe("grid serialization", () => {
	it("serializes single row", () => {
		const result = serializeGridRange([["a", "b", "c"]], { from: 0, to: 2 });
		expect(result).toBe("a\tb\tc\n");
	});

	it("serializes multiple rows", () => {
		const result = serializeGridRange(
			[
				["a", "b"],
				["c", "d"]
			],
			{ from: 0, to: 1 }
		);
		expect(result).toBe("a\tb\nc\td\n");
	});

	it("serializes column range", () => {
		const result = serializeGridRange([["a", "b", "c"]], { from: 1, to: 2 });
		expect(result).toBe("b\tc\n");
	});

	it("escapes cells with tabs for safe round-trip", () => {
		const result = serializeGridRange([["a\tb", "c"]], { from: 0, to: 1 });
		expect(result).toContain('"a\tb"');
	});

	it("escapes cells with newlines", () => {
		const result = serializeGridRange([["a\nb", "c"]], { from: 0, to: 1 });
		expect(result).toContain('"a\nb"');
	});

	it("preserves quotes through escaping", () => {
		const result = serializeGridRange([['a"b', "c"]], { from: 0, to: 1 });
		expect(result).toContain('"a""b"');
	});

	it("round-trip: serialize -> parse equals original", () => {
		const original = [["a", "b", "c"]];
		const serialized = serializeGridRange(original, { from: 0, to: 2 });
		const parsed = parseClipboard(serialized);
		expect(parsed.matrix).toEqual(original);
	});

	it("round-trip with special chars", () => {
		const original = [
			["a,b", "c\nd"],
			["e\tf", "g"]
		];
		const serialized = serializeGridRange(original, { from: 0, to: 1 });
		const parsed = parseClipboard(serialized);
		expect(parsed.matrix).toEqual(original);
	});
});
