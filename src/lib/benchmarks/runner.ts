import { Editor } from "editor";
import { get } from "svelte/store";

import type { BenchmarkFixture, BenchmarkFixtureName } from "./fixtures";
import {
	getBenchmarkEnvironment,
	frameInvariantViolation,
	measureSerializedBytes,
	nextAnimationFrame,
	readLongTasks,
	readMountedNodes,
	readUsedHeapBytes,
	summarizeBenchmarkSamples,
	waitForBrowserIdle,
	waitForMilliseconds,
	type BenchmarkDisplay,
	type BenchmarkEnvironment,
	type BenchmarkCounters,
	type BenchmarkMeasurement,
	type BenchmarkResourceMetrics,
	type BenchmarkSample,
	type BenchmarkSummary
} from "./metrics";

/** Scenarios covered by the browser benchmark harness. */
export type BenchmarkScenarioName =
	| "load"
	| "pan"
	| "zoom"
	| "hover"
	| "drag"
	| "resize"
	| "marquee"
	| "sidebar-scroll"
	| "search"
	| "select-all"
	| "undo"
	| "redo"
	| "autosave"
	| "zoom-to-fit";

/** The complete output written by one browser benchmark session. */
export type BenchmarkReport = {
	generatedAt: string;
	measurement: BenchmarkMeasurement;
	environment: BenchmarkEnvironment;
	fixture: {
		name: BenchmarkFixtureName;
		seed: number;
		elementCount: number;
		fingerprint: string;
	};
	samples: readonly BenchmarkSample[];
	summaries: Readonly<Record<BenchmarkScenarioName, BenchmarkSummary>>;
};

/** Options for running a browser benchmark suite. */
export type BenchmarkRunOptions = {
	fixture: BenchmarkFixture;
	root: HTMLElement;
	display: BenchmarkDisplay;
	measurement?: BenchmarkMeasurement;
	repetitions?: number;
};

/** The required release-soak duration from the performance improvement plan. */
export const BROWSER_SOAK_DURATION_MS = 30 * 60 * 1_000;

/** The default interval between timestamped heap and cache observations. */
export const BROWSER_SOAK_SAMPLE_INTERVAL_MS = 10_000;

/** Options for the production-browser edit/undo/save soak. */
export type BrowserSoakOptions = {
	fixture: BenchmarkFixture;
	root: HTMLElement;
	display: BenchmarkDisplay;
	measurement?: BenchmarkMeasurement;
	durationMs?: number;
	sampleIntervalMs?: number;
};

/** One memory and cache observation from the browser soak. */
export type BrowserSoakSample = {
	elapsedMs: number;
	heapUsedBytes: number | null;
	resources: BenchmarkResourceMetrics;
	counters: BenchmarkCounters;
};

/** The raw artifact produced by the required production-browser soak. */
export type BrowserSoakReport = {
	generatedAt: string;
	measurement: BenchmarkMeasurement;
	requestedDurationMs: number;
	actualDurationMs: number;
	sampleIntervalMs: number;
	cycleCount: number;
	environment: BenchmarkEnvironment;
	fixture: {
		name: BenchmarkFixtureName;
		seed: number;
		elementCount: number;
		fingerprint: string;
	};
	samples: readonly BrowserSoakSample[];
	counters: BenchmarkCounters;
};

const scenarioNames: readonly BenchmarkScenarioName[] = [
	"load",
	"pan",
	"zoom",
	"hover",
	"drag",
	"resize",
	"marquee",
	"sidebar-scroll",
	"search",
	"select-all",
	"undo",
	"redo",
	"autosave",
	"zoom-to-fit"
];

type Timing = {
	applicationSamplesMs: readonly number[];
	frameSamplesMs: readonly number[];
};

/** Lists benchmark scenarios in execution order. */
export function benchmarkScenarioNames(): readonly BenchmarkScenarioName[] {
	return scenarioNames;
}

/** Applies a fixture at the cold setup boundary before a measured scenario. */
export async function applyBenchmarkFixture(fixture: BenchmarkFixture): Promise<void> {
	Editor.benchmark.applyFixture(fixture.project, fixture.imageAssets, fixture.zoom);
	await waitForBrowserIdle();
}

/** Runs every benchmark scenario and returns raw per-frame samples plus median and p95 values. */
export async function runBenchmarkSuite(options: BenchmarkRunOptions): Promise<BenchmarkReport> {
	const repetitions = options.repetitions ?? 3;
	const samples: BenchmarkSample[] = [];
	const buildMode = import.meta.env.PROD ? "production" : "development";

	for (const scenario of scenarioNames) {
		for (let run = 1; run <= repetitions; run += 1) {
			await applyBenchmarkFixture(options.fixture);
			if (scenario === "undo" || scenario === "redo") await prepareHistoryScenario(scenario, options.fixture);

			const sample = await runScenario(scenario, options.fixture, options.root, options.display, run);
			samples.push(sample);
		}
	}

	const summaries = Object.fromEntries(
		scenarioNames.map((scenario) => [
			scenario,
			summarizeBenchmarkSamples(samples.filter((sample) => sample.scenario === scenario))
		])
	) as Record<BenchmarkScenarioName, BenchmarkSummary>;

	return {
		generatedAt: new Date().toISOString(),
		measurement: options.measurement ?? "after",
		environment: getBenchmarkEnvironment(options.display, buildMode),
		fixture: {
			name: options.fixture.name,
			seed: options.fixture.seed,
			elementCount: options.fixture.project.elements.length,
			fingerprint: options.fixture.fingerprint
		},
		samples,
		summaries
	};
}

/** Runs the required edit/undo/save soak while retaining heap and cache observations. */
export async function runBrowserSoak(options: BrowserSoakOptions): Promise<BrowserSoakReport> {
	const requestedDurationMs = positiveDuration(options.durationMs, BROWSER_SOAK_DURATION_MS);
	const sampleIntervalMs = positiveDuration(options.sampleIntervalMs, BROWSER_SOAK_SAMPLE_INTERVAL_MS);
	await applyBenchmarkFixture(options.fixture);
	await Editor.benchmark.persistAssets(options.fixture.imageAssets);
	await Editor.save.flush();
	await waitForBrowserIdle();
	Editor.benchmark.resetCounters();

	const heapStart = readUsedHeapBytes();
	const startedAt = performance.now();
	const samples: BrowserSoakSample[] = [];
	let nextSampleAt = startedAt + sampleIntervalMs;
	let cycleCount = 0;

	const capture = (elapsedMs: number) => {
		const heapUsedBytes = readUsedHeapBytes();
		const nodes = readMountedNodes(options.root);
		samples.push({
			elapsedMs,
			heapUsedBytes,
			resources: {
				mountedNodes: nodes.mountedNodes,
				svgNodes: nodes.svgNodes,
				renderer: nodes.renderer,
				spatialCandidates: nodes.spatialCandidates,
				renderedElements: nodes.renderedElements,
				pathCacheSize: nodes.pathCacheSize,
				imageCacheSize: nodes.imageCacheSize,
				heapGrowthBytes: heapStart !== null && heapUsedBytes !== null ? heapUsedBytes - heapStart : null,
				persistedBytes: null
			},
			counters: Editor.benchmark.getCounters()
		});
	};

	capture(0);
	while (performance.now() - startedAt < requestedDurationMs) {
		const element = options.fixture.project.elements[cycleCount % options.fixture.project.elements.length];
		if (element) {
			const transaction = Editor.history.begin();
			Editor.element.translate(element.id, cycleCount % 2 === 0 ? 1 : -1, 0);
			Editor.history.commit(transaction);
			await Editor.history.undo();
			await Editor.history.redo();
			Editor.save.queue();
		}
		cycleCount += 1;
		await nextAnimationFrame();

		const now = performance.now();
		if (now >= nextSampleAt) {
			await Editor.save.flush();
			await waitForBrowserIdle();
			capture(performance.now() - startedAt);
			do {
				nextSampleAt += sampleIntervalMs;
			} while (nextSampleAt <= now);
		}
	}

	await Editor.save.flush();
	await waitForBrowserIdle();
	const actualDurationMs = performance.now() - startedAt;
	if (samples.at(-1)?.elapsedMs !== actualDurationMs) capture(actualDurationMs);

	const buildMode = import.meta.env.PROD ? "production" : "development";
	return {
		generatedAt: new Date().toISOString(),
		measurement: options.measurement ?? "after",
		requestedDurationMs,
		actualDurationMs,
		sampleIntervalMs,
		cycleCount,
		environment: getBenchmarkEnvironment(options.display, buildMode),
		fixture: {
			name: options.fixture.name,
			seed: options.fixture.seed,
			elementCount: options.fixture.project.elements.length,
			fingerprint: options.fixture.fingerprint
		},
		samples,
		counters: Editor.benchmark.getCounters()
	};
}

function positiveDuration(value: number | undefined, fallback: number): number {
	return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

async function runScenario(
	scenario: BenchmarkScenarioName,
	fixture: BenchmarkFixture,
	root: HTMLElement,
	display: BenchmarkRunOptions["display"],
	run: number
): Promise<BenchmarkSample> {
	if (scenario === "load") {
		await Editor.benchmark.persistAssets(fixture.imageAssets);
		await Editor.save.flush();
	}
	Editor.benchmark.resetCounters();

	const heapBefore = readUsedHeapBytes();
	const startedAt = performance.now();
	const timing = await executeScenario(scenario, fixture, root, display);
	const finishedAt = performance.now();
	const heapAfter = readUsedHeapBytes();
	const longTasks = readLongTasks(startedAt);
	const nodes = readMountedNodes(root);
	const payloadBytes =
		scenario === "autosave" || scenario === "load" ? measureSerializedBytes(fixture.project) : null;
	const counters = Editor.benchmark.getCounters();

	return {
		scenario,
		fixture: fixture.name,
		run,
		scenarioDurationMs: finishedAt - startedAt,
		applicationSamplesMs: timing.applicationSamplesMs,
		frameSamplesMs: timing.frameSamplesMs,
		longTaskMs: longTasks.duration,
		longTaskCount: longTasks.count,
		resources: {
			mountedNodes: nodes.mountedNodes,
			svgNodes: nodes.svgNodes,
			renderer: nodes.renderer,
			spatialCandidates: nodes.spatialCandidates,
			renderedElements: nodes.renderedElements,
			pathCacheSize: nodes.pathCacheSize,
			imageCacheSize: nodes.imageCacheSize,
			heapGrowthBytes: heapBefore !== null && heapAfter !== null ? heapAfter - heapBefore : null,
			persistedBytes: payloadBytes
		},
		counters
	};
}

async function executeScenario(
	scenario: BenchmarkScenarioName,
	fixture: BenchmarkFixture,
	root: HTMLElement,
	display: BenchmarkRunOptions["display"]
): Promise<Timing> {
	switch (scenario) {
		case "load":
			return measureAsync(() => Editor.load("prod"));
		case "pan":
			return measureFrames(60, () => Editor.actions.canvas.pan(8, 4));
		case "zoom":
			return measureFrames(30, () => Editor.actions.canvas.zoomIn());
		case "hover": {
			let hoverIndex = 0;
			return measureFrames(60, () => {
				const elements = fixture.project.elements;
				const index = hoverIndex % Math.min(elements.length, 1_000);
				hoverIndex += 1;
				const element = elements[index];
				if (element) Editor.selection.setHover(element.id);
			});
		}
		case "drag":
			return measureFrames(60, () => {
				const element = fixture.project.elements[0];
				if (element) Editor.element.translate(element.id, 1, 1);
			});
		case "resize":
			return measureFrames(60, () => {
				const element = fixture.project.elements[0];
				if (element && (element.type === "rect" || element.type === "image" || element.type === "text")) {
					Editor.element.resize(element.id, "se", 1, 1, undefined, element);
				}
			});
		case "marquee":
			return measureSync(() => {
				const selected = fixture.project.elements
					.filter((element) => {
						const bounds = Editor.geometry.elementBounds(element);
						return bounds.x < display.viewport.width && bounds.y < display.viewport.height;
					})
					.map((element) => element.id);
				Editor.selection.selectMany(selected);
			});
		case "sidebar-scroll":
			return measureScroll(root);
		case "search":
			return measureSearch(root);
		case "select-all":
			return measureSync(() => Editor.selection.selectAll());
		case "undo":
			return measureAsync(() => Editor.history.undo());
		case "redo":
			return measureAsync(() => Editor.history.redo());
		case "autosave":
			return measureAsync(async () => {
				const element = fixture.project.elements[0];
				if (element) Editor.element.translate(element.id, 1, 0);
				Editor.save.queue();
				await waitForMilliseconds(600);
			});
		case "zoom-to-fit":
			return measureSync(() => {
				const canvas = get(Editor.state.canvas);
				const zoom = Math.min(display.viewport.width / canvas.width, display.viewport.height / canvas.height);
				Editor.actions.canvas.setCamera({
					x: (display.viewport.width - canvas.width * zoom) / 2,
					y: (display.viewport.height - canvas.height * zoom) / 2,
					zoom
				});
			});
	}
}

async function prepareHistoryScenario(scenario: "undo" | "redo", fixture: BenchmarkFixture): Promise<void> {
	const element = fixture.project.elements[0];
	if (!element) return;
	const transaction = Editor.history.begin();
	Editor.element.translate(element.id, 1, 0);
	Editor.history.commit(transaction);
	if (scenario === "redo") await Editor.history.undo();
	Editor.benchmark.resetCounters();
}

function measureSync(operation: () => void): Promise<Timing> {
	const frameStarted = performance.now();
	const applicationStarted = frameStarted;
	operation();
	const applicationMs = performance.now() - applicationStarted;
	return measureFrame(frameStarted).then((frameMs) => ({
		applicationSamplesMs: [applicationMs],
		frameSamplesMs: [frameMs]
	}));
}

async function measureAsync(operation: () => Promise<void>): Promise<Timing> {
	const frameStarted = performance.now();
	const applicationStarted = frameStarted;
	await operation();
	const applicationMs = performance.now() - applicationStarted;
	const frameMs = await measureFrame(frameStarted);
	return { applicationSamplesMs: [applicationMs], frameSamplesMs: [frameMs] };
}

async function measureFrames(frames: number, operation: () => void): Promise<Timing> {
	const applicationSamplesMs: number[] = [];
	const frameSamplesMs: number[] = [];
	for (let frame = 0; frame < frames; frame += 1) {
		const before = Editor.benchmark.getCounters();
		const frameStarted = performance.now();
		const applicationStarted = frameStarted;
		operation();
		applicationSamplesMs.push(performance.now() - applicationStarted);
		const after = Editor.benchmark.getCounters();
		const violation = frameInvariantViolation(before, after);
		if (violation) throw new Error(`Frame ${frame + 1}: ${violation}.`);
		frameSamplesMs.push(await measureFrame(frameStarted));
	}
	return { applicationSamplesMs, frameSamplesMs };
}

async function measureFrame(frameStarted: number): Promise<number> {
	await nextAnimationFrame();
	return performance.now() - frameStarted;
}

function measureScroll(root: HTMLElement): Promise<Timing> {
	const viewport = root.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]');
	return measureSync(() => {
		if (!viewport) return;
		viewport.scrollTop = Math.min(viewport.scrollHeight, viewport.clientHeight * 8);
		viewport.dispatchEvent(new Event("scroll"));
	});
}

function measureSearch(root: HTMLElement): Promise<Timing> {
	const input = root.querySelector<HTMLInputElement>('input[aria-label="Search elements by name"]');
	return measureAsync(async () => {
		if (!input) return;
		input.value = "Element 499";
		input.dispatchEvent(new Event("input", { bubbles: true }));
		await waitForMilliseconds(250);
	});
}
