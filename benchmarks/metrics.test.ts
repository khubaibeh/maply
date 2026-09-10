import { describe, expect, it } from "vitest";

import { frameInvariantViolation, median, p95 } from "../src/lib/benchmarks/metrics";

describe("benchmark metrics", () => {
	it("summarizes medians and p95 values without mutating samples", () => {
		const values = [9, 1, 5, 3, 7];

		expect(median(values)).toBe(5);
		expect(p95(values)).toBe(9);
		expect(values).toEqual([9, 1, 5, 3, 7]);
	});

	it("rejects more than one document change in a frame", () => {
		const before = { documentRevisions: 2, changePublications: 2, historyRecords: 0, saveRequests: 0 };
		const oneChange = { ...before, documentRevisions: 3, changePublications: 3 };
		const twoChanges = { ...before, documentRevisions: 4, changePublications: 4 };

		expect(frameInvariantViolation(before, oneChange)).toBeNull();
		expect(frameInvariantViolation(before, twoChanges)).toContain("invariant violated");
	});
});
