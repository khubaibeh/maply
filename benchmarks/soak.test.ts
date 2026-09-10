import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { createIndexedDocument } from "../editor/state/indexed-document";
import { createBenchmarkFixture } from "../src/lib/benchmarks/fixtures";

describe("indexed editor soak", () => {
	it("keeps the 50k indexed document stable across repeated edits", () => {
		const fixture = createBenchmarkFixture("50k-typical");
		const document = createIndexedDocument(fixture.project.elements);
		const target = fixture.project.elements[0];
		expect(target).toBeDefined();
		if (!target) return;

		const startedAt = performance.now();
		for (let cycle = 0; cycle < 1_000; cycle += 1) {
			document.update(target.id, (element) => ({ ...element, x: element.x + (cycle % 2 === 0 ? 1 : -1) }));
		}
		const durationMs = performance.now() - startedAt;
		const snapshot = document.snapshot();
		expect(snapshot).toHaveLength(50_000);
		expect(new Set(snapshot.map((element) => element.id)).size).toBe(50_000);

		mkdirSync(resolve(process.cwd(), "benchmark-results"), { recursive: true });
		writeFileSync(
			resolve(process.cwd(), "benchmark-results/indexed-soak.json"),
			JSON.stringify(
				{
					fixture: fixture.name,
					fingerprint: fixture.fingerprint,
					cycles: 1_000,
					durationMs: Number(durationMs.toFixed(3)),
					finalElementCount: snapshot.length,
					uniqueElementCount: new Set(snapshot.map((element) => element.id)).size,
					memoryMeasurement: "not exposed by the Node benchmark runner"
				},
				null,
				2
			)
		);
	});
});
