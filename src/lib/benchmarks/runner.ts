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
	repetitions?: number;
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

type Timing = { applicationMs: number; frameMs: number };

/** Lists benchmark scenarios in execution order. */
export function benchmarkScenarioNames(): readonly BenchmarkScenarioName[] {
	return scenarioNames;
}

/** Applies a fixture at the cold setup boundary before a measured scenario. */
export async function applyBenchmarkFixture(fixture: BenchmarkFixture): Promise<void> {
	Editor.benchmark.applyFixture(fixture.project, fixture.imageAssets, fixture.zoom);
	await waitForBrowserIdle();
}

/** Runs every baseline scenario and returns raw samples plus median and p95 values. */
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
		applicationMs: timing.applicationMs,
		frameMs: Math.max(timing.frameMs, finishedAt - startedAt),
		longTaskMs: longTasks.duration,
		longTaskCount: longTasks.count,
		resources: {
			mountedNodes: nodes.mountedNodes,
			svgNodes: nodes.svgNodes,
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
	const started = performance.now();
	operation();
	const applicationMs = performance.now() - started;
	return nextAnimationFrame().then((frameFinished) => ({ applicationMs, frameMs: frameFinished - started }));
}

async function measureAsync(operation: () => Promise<void>): Promise<Timing> {
	const started = performance.now();
	await operation();
	const applicationMs = performance.now() - started;
	const frameFinished = await nextAnimationFrame();
	return { applicationMs, frameMs: frameFinished - started };
}

async function measureFrames(frames: number, operation: () => void): Promise<Timing> {
	let applicationMs = 0;
	let frameMs = 0;
	for (let frame = 0; frame < frames; frame += 1) {
		const before = Editor.benchmark.getCounters();
		const applicationStarted = performance.now();
		operation();
		applicationMs += performance.now() - applicationStarted;
		const after = Editor.benchmark.getCounters();
		const violation = frameInvariantViolation(before, after);
		if (violation) throw new Error(`Frame ${frame + 1}: ${violation}.`);
		const frameStarted = performance.now();
		await nextAnimationFrame();
		frameMs += performance.now() - frameStarted;
	}
	return { applicationMs, frameMs };
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
