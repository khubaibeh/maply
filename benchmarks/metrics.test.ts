import { describe, expect, it } from "vitest";

import {
	frameInvariantViolation,
	median,
	p95,
	summarizeBenchmarkSamples,
	type BenchmarkSample
} from "../src/lib/benchmarks/metrics";

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

	it("summarizes individual application and frame samples", () => {
		const sample = (
			applicationSamplesMs: readonly number[],
			frameSamplesMs: readonly number[]
		): BenchmarkSample => ({
			scenario: "drag",
			fixture: "50k-typical",
			run: 1,
			scenarioDurationMs: 100,
			applicationSamplesMs,
			frameSamplesMs,
			longTaskMs: 0,
			longTaskCount: 0,
			resources: {
				mountedNodes: 0,
				svgNodes: 0,
				renderer: null,
				spatialCandidates: null,
				renderedElements: null,
				pathCacheSize: null,
				imageCacheSize: null,
				heapGrowthBytes: null,
				persistedBytes: null
			},
			counters: { documentRevisions: 0, changePublications: 0, historyRecords: 0, saveRequests: 0 }
		});

		const summary = summarizeBenchmarkSamples([sample([1, 100], [2, 8]), sample([3], [4])]);

		expect(summary.applicationSamples).toBe(3);
		expect(summary.frameSamples).toBe(3);
		expect(summary.applicationMs).toEqual({ median: 3, p95: 100 });
		expect(summary.frameMs).toEqual({ median: 4, p95: 8 });
	});
});
