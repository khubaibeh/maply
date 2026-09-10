import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { createIndexedDocument } from "../editor/state/indexed-document";
import { chooseCanvasRenderer } from "../src/components/canvas/canvas-renderer";
import { createBenchmarkFixture } from "../src/lib/benchmarks/fixtures";

describe("renderer decision benchmark", () => {
	it("records the deterministic typical and all-visible gate", () => {
		const scenarios = ["50k-typical", "50k-all-visible"] as const;
		const results = scenarios.map((name) => {
			const fixture = createBenchmarkFixture(name);
			const document = createIndexedDocument(fixture.project.elements);
			const candidates = document.query({
				x: 0,
				y: 0,
				width: fixture.viewport.width,
				height: fixture.viewport.height
			}).length;
			return {
				name,
				seed: fixture.seed,
				fingerprint: fixture.fingerprint,
				documentSize: document.size(),
				viewport: fixture.viewport,
				candidateElements: candidates,
				renderer: chooseCanvasRenderer(document.size(), candidates)
			};
		});

		expect(results[0]?.renderer).toBe("svg");
		expect(results[1]?.renderer).toBe("canvas");
		expect(results[1]?.candidateElements).toBeGreaterThan(2_000);

		mkdirSync(resolve(process.cwd(), "benchmark-results"), { recursive: true });
		writeFileSync(
			resolve(process.cwd(), "benchmark-results/renderer-decision.json"),
			JSON.stringify(
				{
					measurement: "deterministic indexed candidate gate",
					threshold: 2_000,
					results
				},
				null,
				2
			)
		);
	});
});
