import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
	benchmarkFixtureNames,
	createBenchmarkFixture,
	getBenchmarkFixtureManifest
} from "../src/lib/benchmarks/fixtures";

describe("benchmark fixtures", () => {
	it("generates the plan fixtures deterministically", () => {
		const manifests = benchmarkFixtureNames().map((name) => {
			const fixture = createBenchmarkFixture(name);
			const repeat = createBenchmarkFixture(name);

			expect(repeat.fingerprint, `${name} changed between generations`).toBe(fixture.fingerprint);
			return getBenchmarkFixtureManifest(fixture);
		});

		const outputDirectory = resolve(process.cwd(), "benchmark-results");
		mkdirSync(outputDirectory, { recursive: true });
		writeFileSync(
			resolve(outputDirectory, "fixtures.json"),
			`${JSON.stringify({ generatedAt: new Date().toISOString(), fixtures: manifests }, null, 2)}\n`,
			"utf8"
		);

		expect(manifests.map((manifest) => manifest.elementCount)).toEqual([1_000, 10_000, 50_000, 50_000, 50_000]);
	});
});
