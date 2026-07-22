import { describe, expect, it } from "vitest";

import {
	normalizeRange,
	isInRange,
	cellStatus,
	updateHeaderSelection,
	type NormalizedRange
} from "../../../src/components/elements-panel/grid/grid-selection";

describe("range normalization", () => {
	it("normalizes anchor-first range", () => {
		const range = { anchor: { r: 0, c: 0 }, focus: { r: 2, c: 2 } };
		const result = normalizeRange(range);
		expect(result).toEqual({ minRow: 0, maxRow: 2, minCol: 0, maxCol: 2 });
	});

	it("normalizes focus-first range", () => {
		const range = { anchor: { r: 2, c: 2 }, focus: { r: 0, c: 0 } };
		const result = normalizeRange(range);
		expect(result).toEqual({ minRow: 0, maxRow: 2, minCol: 0, maxCol: 2 });
	});

	it("normalizes mixed ordering", () => {
		const range = { anchor: { r: 0, c: 2 }, focus: { r: 2, c: 0 } };
		const result = normalizeRange(range);
		expect(result).toEqual({ minRow: 0, maxRow: 2, minCol: 0, maxCol: 2 });
	});

	it("handles single-cell range", () => {
		const range = { anchor: { r: 1, c: 1 }, focus: { r: 1, c: 1 } };
		const result = normalizeRange(range);
		expect(result).toEqual({ minRow: 1, maxRow: 1, minCol: 1, maxCol: 1 });
	});
});

describe("range containment", () => {
	const range: NormalizedRange = { minRow: 0, maxRow: 2, minCol: 0, maxCol: 2 };

	it("contains top-left corner", () => {
		expect(isInRange({ r: 0, c: 0 }, range)).toBe(true);
	});

	it("contains bottom-right corner", () => {
		expect(isInRange({ r: 2, c: 2 }, range)).toBe(true);
	});

	it("contains center", () => {
		expect(isInRange({ r: 1, c: 1 }, range)).toBe(true);
	});

	it("excludes outside top", () => {
		expect(isInRange({ r: -1, c: 1 }, range)).toBe(false);
	});

	it("excludes outside bottom", () => {
		expect(isInRange({ r: 3, c: 1 }, range)).toBe(false);
	});

	it("excludes outside left", () => {
		expect(isInRange({ r: 1, c: -1 }, range)).toBe(false);
	});

	it("excludes outside right", () => {
		expect(isInRange({ r: 1, c: 3 }, range)).toBe(false);
	});
});

describe("cell status", () => {
	it("returns editing when editing address matches", () => {
		const status = cellStatus({ r: 0, c: 0 }, { r: 0, c: 0 }, null, { r: 0, c: 0 });
		expect(status).toBe("editing");
	});

	it("returns active when active address matches", () => {
		const status = cellStatus({ r: 0, c: 0 }, { r: 0, c: 0 }, null, null);
		expect(status).toBe("active");
	});

	it("returns selected when in selection range", () => {
		const selection = { anchor: { r: 0, c: 0 }, focus: { r: 2, c: 2 } };
		const status = cellStatus({ r: 1, c: 1 }, null, selection, null);
		expect(status).toBe("selected");
	});

	it("returns normal when no state matches", () => {
		const status = cellStatus({ r: 5, c: 5 }, { r: 0, c: 0 }, null, null);
		expect(status).toBe("normal");
	});

	it("prioritizes editing over active", () => {
		const status = cellStatus({ r: 0, c: 0 }, { r: 0, c: 0 }, null, { r: 0, c: 0 });
		expect(status).toBe("editing");
	});

	it("prioritizes active over selected", () => {
		const selection = { anchor: { r: 0, c: 0 }, focus: { r: 2, c: 2 } };
		const status = cellStatus({ r: 0, c: 0 }, { r: 0, c: 0 }, selection, null);
		expect(status).toBe("active");
	});

	it("prioritizes selected over normal", () => {
		const selection = { anchor: { r: 0, c: 0 }, focus: { r: 2, c: 2 } };
		const status = cellStatus({ r: 1, c: 1 }, null, selection, null);
		expect(status).toBe("selected");
	});
});

describe("header selection", () => {
	it("selects single index", () => {
		const result = updateHeaderSelection(null, 0, false, false);
		expect(result?.has(0)).toBe(true);
		expect(result?.size).toBe(1);
	});

	it("toggle adds to selection", () => {
		let current = updateHeaderSelection(null, 0, false, false);
		current = updateHeaderSelection(current, 1, false, true);
		expect(current?.has(0)).toBe(true);
		expect(current?.has(1)).toBe(true);
	});

	it("toggle removes from selection", () => {
		let current = updateHeaderSelection(null, 0, false, false);
		current = updateHeaderSelection(current, 0, false, true);
		expect(current).toBe(null);
	});

	it("shift extends to contiguous range", () => {
		let current = updateHeaderSelection(null, 0, false, false);
		current = updateHeaderSelection(current, 2, true, false);
		expect(current?.has(0)).toBe(true);
		expect(current?.has(1)).toBe(true);
		expect(current?.has(2)).toBe(true);
		expect(current?.size).toBe(3);
	});

	it("shift within existing range", () => {
		let current: Set<number> | null = new Set([0, 1, 2]);
		current = updateHeaderSelection(current, 3, true, false);
		expect(current?.has(0)).toBe(true);
		expect(current?.has(3)).toBe(true);
		expect(current?.size).toBe(4);
	});

	it("single click replaces selection", () => {
		let current: Set<number> | null = updateHeaderSelection(null, 0, false, false);
		current = updateHeaderSelection(current, 2, false, false);
		expect(current?.has(0)).toBe(false);
		expect(current?.has(2)).toBe(true);
		expect(current?.size).toBe(1);
	});

	it("returns null when all deselected", () => {
		const result = updateHeaderSelection(new Set([0]), 0, false, true);
		expect(result).toBe(null);
	});
});
