/** A measured browser viewport and camera scale. */
export type BenchmarkDisplay = {
	viewport: { width: number; height: number };
	zoom: number;
};

/** Browser and build details recorded with every benchmark report. */
export type BenchmarkEnvironment = BenchmarkDisplay & {
	browser: string;
	hardwareConcurrency: number | null;
	deviceMemoryGb: number | null;
	buildMode: "development" | "production";
};

/** DOM and memory observations captured after a scenario. */
export type BenchmarkResourceMetrics = {
	mountedNodes: number;
	svgNodes: number;
	renderer: "svg" | "canvas" | null;
	spatialCandidates: number | null;
	renderedElements: number | null;
	heapGrowthBytes: number | null;
	persistedBytes: number | null;
};

/** One measured run of one benchmark scenario. */
export type BenchmarkSample = {
	scenario: string;
	fixture: string;
	run: number;
	applicationMs: number;
	frameMs: number;
	longTaskMs: number;
	longTaskCount: number;
	resources: BenchmarkResourceMetrics;
	counters: BenchmarkCounters;
};

/** Lightweight editor counters captured with one benchmark sample. */
export type BenchmarkCounters = {
	documentRevisions: number;
	changePublications: number;
	historyRecords: number;
	saveRequests: number;
};

/** Returns an error when one measured frame publishes more than one document change. */
export function frameInvariantViolation(before: BenchmarkCounters, after: BenchmarkCounters): string | null {
	const documentRevisions = after.documentRevisions - before.documentRevisions;
	const changePublications = after.changePublications - before.changePublications;
	if (
		documentRevisions < 0 ||
		changePublications < 0 ||
		documentRevisions > 1 ||
		changePublications > 1 ||
		documentRevisions !== changePublications
	) {
		return "one-mutation/one-publication-per-frame invariant violated";
	}
	return null;
}

/** Median and p95 values for a set of benchmark samples. */
export type BenchmarkSummary = {
	runs: number;
	applicationMs: { median: number; p95: number };
	frameMs: { median: number; p95: number };
	longTaskMs: { median: number; p95: number };
	longTaskCount: { median: number; p95: number };
};

/** Reads browser details without making the benchmark depend on optional APIs. */
export function getBenchmarkEnvironment(
	display: BenchmarkDisplay,
	buildMode: BenchmarkEnvironment["buildMode"]
): BenchmarkEnvironment {
	const browserNavigator = navigator as Navigator & { readonly deviceMemory?: number };
	return {
		...display,
		browser: navigator.userAgent,
		hardwareConcurrency: navigator.hardwareConcurrency ?? null,
		deviceMemoryGb: browserNavigator.deviceMemory ?? null,
		buildMode
	};
}

/** Waits for one browser paint and returns its timestamp. */
export function nextAnimationFrame(): Promise<number> {
	return new Promise((resolve) => requestAnimationFrame(resolve));
}

/** Waits for two paints so Svelte updates and browser layout can settle. */
export async function waitForBrowserIdle(): Promise<void> {
	await nextAnimationFrame();
	await nextAnimationFrame();
}

/** Waits for a caller-specified number of milliseconds. */
export function waitForMilliseconds(milliseconds: number): Promise<void> {
	return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

/** Returns the used JavaScript heap size when the browser exposes it. */
export function readUsedHeapBytes(): number | null {
	if (!("memory" in performance)) return null;
	// SAFETY: Chromium exposes `performance.memory`; browsers without it are handled above.
	const browserPerformance = performance as Performance & {
		readonly memory?: { readonly usedJSHeapSize?: number };
	};
	const used = browserPerformance.memory?.usedJSHeapSize;
	return typeof used === "number" ? used : null;
}

/** Returns long-task entries that started after the supplied performance timestamp. */
export function readLongTasks(startTime: number): { duration: number; count: number } {
	const entries = performance.getEntriesByType("longtask").filter((entry) => entry.startTime >= startTime);
	return {
		duration: entries.reduce((total, entry) => total + entry.duration, 0),
		count: entries.length
	};
}

/** Counts all mounted descendants and SVG descendants below a benchmark root. */
export function readMountedNodes(root: ParentNode): {
	mountedNodes: number;
	svgNodes: number;
	renderer: "svg" | "canvas" | null;
	spatialCandidates: number | null;
	renderedElements: number | null;
} {
	const rendererNode = root.querySelector<HTMLElement>("[data-renderer]");
	const canvasNode = root.querySelector<HTMLElement>("[data-canvas-renderer]");
	const candidateValue = canvasNode?.dataset.candidateElements;
	const renderedNode = root.querySelector<HTMLElement>("[data-rendered-elements]");
	const renderedValue = renderedNode?.dataset.renderedElements;
	const readCount = (value: string | undefined): number | null => {
		if (value === undefined) return null;
		const count = Number(value);
		return Number.isFinite(count) && count >= 0 ? count : null;
	};
	return {
		mountedNodes: root.querySelectorAll("*").length,
		svgNodes: root.querySelectorAll("svg *").length,
		renderer: rendererNode?.dataset.renderer === "canvas" || canvasNode ? "canvas" : rendererNode ? "svg" : null,
		spatialCandidates: readCount(candidateValue),
		renderedElements: readCount(renderedValue)
	};
}

/** Measures the UTF-8 size of a value prepared for persistence. */
export function measureSerializedBytes(value: unknown): number {
	return new TextEncoder().encode(JSON.stringify(value) ?? "").byteLength;
}

/** Returns the median of a numeric sample. */
export function median(values: readonly number[]): number {
	if (values.length === 0) return 0;
	const sorted = [...values].sort((left, right) => left - right);
	const middle = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 0 ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2 : (sorted[middle] ?? 0);
}

/** Returns the nearest-rank p95 of a numeric sample. */
export function p95(values: readonly number[]): number {
	if (values.length === 0) return 0;
	const sorted = [...values].sort((left, right) => left - right);
	const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
	return sorted[index] ?? 0;
}

/** Summarizes the timing fields of repeated benchmark samples. */
export function summarizeBenchmarkSamples(samples: readonly BenchmarkSample[]): BenchmarkSummary {
	const values = (select: (sample: BenchmarkSample) => number) => samples.map(select);
	return {
		runs: samples.length,
		applicationMs: summarize(values((sample) => sample.applicationMs)),
		frameMs: summarize(values((sample) => sample.frameMs)),
		longTaskMs: summarize(values((sample) => sample.longTaskMs)),
		longTaskCount: summarize(values((sample) => sample.longTaskCount))
	};
}

function summarize(values: readonly number[]): { median: number; p95: number } {
	return { median: median(values), p95: p95(values) };
}
