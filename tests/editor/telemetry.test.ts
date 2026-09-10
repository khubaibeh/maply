import {
	flushEditorTelemetry,
	recordEditorCommand,
	recordEditorFailure,
	recordEditorFrame,
	recordEditorRender,
	recordSaveBatch,
	recordSpatialQuery,
	setEditorTelemetrySink
} from "editor/telemetry";
import { describe, expect, it } from "vitest";

describe("editor telemetry", () => {
	it("aggregates safe performance counters and typed failure tags", () => {
		const snapshots: unknown[] = [];
		const restore = setEditorTelemetrySink((snapshot) => snapshots.push(snapshot));

		recordEditorCommand("update", 9, 1);
		recordEditorFrame(18, 12);
		recordSpatialQuery("bounds", 7);
		recordEditorRender("canvas", 4, 7, 6);
		recordSaveBatch(2, 1);
		recordEditorFailure("save", "PersistenceFailed");
		flushEditorTelemetry();
		restore();

		expect(snapshots).toEqual([
			{
				commands: {
					count: 1,
					slowCount: 1,
					maxDurationMs: 9,
					maxChangedElements: 1,
					lastTag: "update"
				},
				frames: { count: 1, slowCount: 1, maxDurationMs: 18, maxRenderedElements: 12 },
				spatialQueries: { count: 1, candidateCount: 7, maxCandidates: 7, lastKind: "bounds" },
				renders: {
					count: 1,
					maxDurationMs: 4,
					maxCandidates: 7,
					maxRenderedElements: 6,
					lastRenderer: "canvas"
				},
				saveBatches: { count: 1, changeSetCount: 2, elementRecordCount: 1, maxElementRecordCount: 1 },
				failures: { count: 1, tags: { "save:PersistenceFailed": 1 } }
			}
		]);
	});
});
