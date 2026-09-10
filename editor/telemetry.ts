import type { DocumentChangeTag } from "./state/document-change";

const TELEMETRY_EVENT = "maply:editor-telemetry";
const SLOW_COMMAND_MS = 8;
const SLOW_FRAME_MS = 16.7;
const FLUSH_INTERVAL_MS = 1_000;

/** The two interactive renderer implementations reported by editor telemetry. */
export type EditorRendererKind = "svg" | "canvas";

/** The spatial query operations reported by editor telemetry. */
export type SpatialQueryKind = "bounds" | "point";

/** One aggregate telemetry window emitted to the host application. */
export type EditorTelemetrySnapshot = {
	commands: {
		count: number;
		slowCount: number;
		maxDurationMs: number;
		maxChangedElements: number;
		lastTag: DocumentChangeTag | null;
	};
	frames: {
		count: number;
		slowCount: number;
		maxDurationMs: number;
		maxRenderedElements: number;
	};
	spatialQueries: {
		count: number;
		candidateCount: number;
		maxCandidates: number;
		lastKind: SpatialQueryKind | null;
	};
	renders: {
		count: number;
		maxDurationMs: number;
		maxCandidates: number;
		maxRenderedElements: number;
		lastRenderer: EditorRendererKind | null;
	};
	saveBatches: {
		count: number;
		changeSetCount: number;
		elementRecordCount: number;
		maxElementRecordCount: number;
	};
	failures: {
		count: number;
		tags: Readonly<Record<string, number>>;
	};
};

/** Receives one safe aggregate telemetry window. */
export type EditorTelemetrySink = (snapshot: EditorTelemetrySnapshot) => void;

type MutableSnapshot = {
	commands: EditorTelemetrySnapshot["commands"];
	frames: EditorTelemetrySnapshot["frames"];
	spatialQueries: EditorTelemetrySnapshot["spatialQueries"];
	renders: EditorTelemetrySnapshot["renders"];
	saveBatches: EditorTelemetrySnapshot["saveBatches"];
	failures: { count: number; tags: Record<string, number> };
};

function emptySnapshot(): MutableSnapshot {
	return {
		commands: { count: 0, slowCount: 0, maxDurationMs: 0, maxChangedElements: 0, lastTag: null },
		frames: { count: 0, slowCount: 0, maxDurationMs: 0, maxRenderedElements: 0 },
		spatialQueries: { count: 0, candidateCount: 0, maxCandidates: 0, lastKind: null },
		renders: { count: 0, maxDurationMs: 0, maxCandidates: 0, maxRenderedElements: 0, lastRenderer: null },
		saveBatches: { count: 0, changeSetCount: 0, elementRecordCount: 0, maxElementRecordCount: 0 },
		failures: { count: 0, tags: {} }
	};
}

let pending = emptySnapshot();
let timer: ReturnType<typeof setTimeout> | null = null;
let sink: EditorTelemetrySink | null = null;

function scheduleFlush(): void {
	if (timer !== null || typeof setTimeout === "undefined") return;
	timer = setTimeout(() => {
		timer = null;
		flushEditorTelemetry();
	}, FLUSH_INTERVAL_MS);
}

function finite(value: number): number {
	return Number.isFinite(value) && value >= 0 ? value : 0;
}

function emit(snapshot: MutableSnapshot): void {
	const safeSnapshot: EditorTelemetrySnapshot = {
		...snapshot,
		failures: { count: snapshot.failures.count, tags: { ...snapshot.failures.tags } }
	};
	sink?.(safeSnapshot);
	if (typeof window !== "undefined" && typeof CustomEvent !== "undefined") {
		window.dispatchEvent(new CustomEvent(TELEMETRY_EVENT, { detail: safeSnapshot }));
	}
}

/** Installs a host sink and returns a scoped restoration function. */
export function setEditorTelemetrySink(next: EditorTelemetrySink | null): () => void {
	const previous = sink;
	sink = next;
	return () => {
		if (sink === next) sink = previous;
	};
}

/** Flushes the current aggregate window immediately. */
export function flushEditorTelemetry(): void {
	if (timer !== null) {
		clearTimeout(timer);
		timer = null;
	}
	const current = pending;
	pending = emptySnapshot();
	if (
		current.commands.count === 0 &&
		current.frames.count === 0 &&
		current.spatialQueries.count === 0 &&
		current.renders.count === 0 &&
		current.saveBatches.count === 0 &&
		current.failures.count === 0
	)
		return;
	emit(current);
}

/** Records one accepted indexed-document command. */
export function recordEditorCommand(tag: DocumentChangeTag, durationMs: number, changedElements: number): void {
	const duration = finite(durationMs);
	pending.commands.count += 1;
	pending.commands.lastTag = tag;
	pending.commands.maxDurationMs = Math.max(pending.commands.maxDurationMs, duration);
	pending.commands.maxChangedElements = Math.max(pending.commands.maxChangedElements, Math.max(0, changedElements));
	if (duration > SLOW_COMMAND_MS) pending.commands.slowCount += 1;
	scheduleFlush();
}

/** Records one rendered animation frame and its measured element count. */
export function recordEditorFrame(durationMs: number, renderedElements: number): void {
	const duration = finite(durationMs);
	pending.frames.count += 1;
	pending.frames.maxDurationMs = Math.max(pending.frames.maxDurationMs, duration);
	pending.frames.maxRenderedElements = Math.max(pending.frames.maxRenderedElements, Math.max(0, renderedElements));
	if (duration > SLOW_FRAME_MS) pending.frames.slowCount += 1;
	scheduleFlush();
}

/** Records the candidate count from one indexed spatial query. */
export function recordSpatialQuery(kind: SpatialQueryKind, candidates: number): void {
	const count = Math.max(0, candidates);
	pending.spatialQueries.count += 1;
	pending.spatialQueries.candidateCount += count;
	pending.spatialQueries.maxCandidates = Math.max(pending.spatialQueries.maxCandidates, count);
	pending.spatialQueries.lastKind = kind;
	scheduleFlush();
}

/** Records one interactive renderer paint without recording document content. */
export function recordEditorRender(
	renderer: EditorRendererKind,
	durationMs: number,
	candidates: number,
	renderedElements: number
): void {
	pending.renders.count += 1;
	pending.renders.lastRenderer = renderer;
	pending.renders.maxDurationMs = Math.max(pending.renders.maxDurationMs, finite(durationMs));
	pending.renders.maxCandidates = Math.max(pending.renders.maxCandidates, Math.max(0, candidates));
	pending.renders.maxRenderedElements = Math.max(pending.renders.maxRenderedElements, Math.max(0, renderedElements));
	scheduleFlush();
}

/** Records one incremental save batch and its changed element-record count. */
export function recordSaveBatch(changeSetCount: number, elementRecordCount: number): void {
	const records = Math.max(0, elementRecordCount);
	pending.saveBatches.count += 1;
	pending.saveBatches.changeSetCount += Math.max(0, changeSetCount);
	pending.saveBatches.elementRecordCount += records;
	pending.saveBatches.maxElementRecordCount = Math.max(pending.saveBatches.maxElementRecordCount, records);
	scheduleFlush();
}

/** Records a typed failure tag and its safe operation name. */
export function recordEditorFailure(operation: string, tag: string): void {
	const safeTag = tag || "UnknownFailure";
	pending.failures.count += 1;
	pending.failures.tags[`${operation}:${safeTag}`] = (pending.failures.tags[`${operation}:${safeTag}`] ?? 0) + 1;
	scheduleFlush();
}
