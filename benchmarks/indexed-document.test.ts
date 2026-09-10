import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { createIndexedDocument } from "../editor/state/indexed-document";
import { createBenchmarkFixture } from "../src/lib/benchmarks/fixtures";

describe("indexed-document benchmark", () => {
	it("keeps a 50k single-element update under the application budget", () => {
		const fixture = createBenchmarkFixture("50k-typical");
		const document = createIndexedDocument(fixture.project.elements);
		const target = fixture.project.elements[0];
		expect(target).toBeDefined();
		if (!target) return;

		const samples: number[] = [];
		for (let run = 0; run < 40; run += 1) {
			const started = performance.now();
			document.update(target.id, (element) => ({ ...element, x: element.x + 1 }));
			samples.push(performance.now() - started);
		}
		const sorted = [...samples].sort((left, right) => left - right);
		const p95 = sorted[Math.ceil(sorted.length * 0.95) - 1] ?? 0;
		const middle = Math.floor(sorted.length / 2);
		const median =
			sorted.length % 2 === 0 ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2 : (sorted[middle] ?? 0);

		expect(p95).toBeLessThan(8);
		mkdirSync(resolve(process.cwd(), "benchmark-results"), { recursive: true });
		writeFileSync(
			resolve(process.cwd(), "benchmark-results/indexed-mutation.json"),
			JSON.stringify(
				{
					fixture: fixture.name,
					fingerprint: fixture.fingerprint,
					sampleCount: samples.length,
					medianMs: Number(median.toFixed(3)),
					p95Ms: Number(p95.toFixed(3)),
					budgetMs: 8,
					measurement: "indexed mutation only; excludes browser paint"
				},
				null,
				2
			)
		);
	});
});
