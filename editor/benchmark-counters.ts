/** Counts observable editor work for benchmark runs. */
export type EditorBenchmarkCounters = {
	documentRevisions: number;
	changePublications: number;
	historyRecords: number;
	saveRequests: number;
};

const counters: EditorBenchmarkCounters = {
	documentRevisions: 0,
	changePublications: 0,
	historyRecords: 0,
	saveRequests: 0
};

/** Resets the counters used by the browser benchmark harness. */
export function resetEditorBenchmarkCounters(): void {
	counters.documentRevisions = 0;
	counters.changePublications = 0;
	counters.historyRecords = 0;
	counters.saveRequests = 0;
}

/** Returns a copy of the current benchmark counters. */
export function getEditorBenchmarkCounters(): EditorBenchmarkCounters {
	return { ...counters };
}

/** Records one accepted project-state transition. */
export function recordDocumentRevision(): void {
	counters.documentRevisions += 1;
}

/** Records one project-store publication. */
export function recordChangePublication(): void {
	counters.changePublications += 1;
}

/** Records one history entry created from a document change. */
export function recordHistoryRecord(): void {
	counters.historyRecords += 1;
}

/** Records one complete project save request. */
export function recordSaveRequest(): void {
	counters.saveRequests += 1;
}
