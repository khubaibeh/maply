import { createElementNameGrid } from "@maply/model";
import type { RectElement } from "@maply/model/types";
import { get } from "svelte/store";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getEditorBenchmarkCounters, resetEditorBenchmarkCounters } from "../../editor/benchmark-counters";
import { translateElement } from "../../editor/elements/mutate";
import { history } from "../../editor/history";
import { projectState, setProjectState } from "../../editor/state/document";
import { canvasState } from "../../editor/state/workspace";
import { createPointerDrag } from "../../src/components/canvas/interaction/pointer-drag.svelte";

type Listener = (event: PointerEvent) => void;

const element: RectElement = {
	id: "rect",
	name: "Rect",
	type: "rect",
	locked: false,
	visible: true,
	bindable: true,
	x: 0,
	y: 0,
	width: 10,
	height: 10,
	fill: "#000",
	stroke: "#000",
	strokeWidth: 1
};

function pointer(pointerId: number, x: number): PointerEvent {
	return { pointerId, clientX: x } as PointerEvent;
}

function installWindow() {
	const listeners = new Map<string, Listener>();
	const frames = new Map<number, FrameRequestCallback>();
	let nextFrame = 1;
	const windowStub = {
		addEventListener: (type: string, listener: Listener) => listeners.set(type, listener),
		removeEventListener: (type: string) => listeners.delete(type)
	};
	vi.stubGlobal("window", windowStub);
	vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
		const id = nextFrame++;
		frames.set(id, callback);
		return id;
	});
	vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
	return { listeners, frames };
}

function setFixture() {
	canvasState.set({ width: 100, height: 100, color: "#fff", x: 0, y: 0, camera: { x: 0, y: 0, zoom: 1 } });
	setProjectState(
		{
			id: "prod",
			name: "Pointer drag",
			elements: [element],
			elementNameGrid: createElementNameGrid(),
			isElementNameImportOpen: true,
			initialized: true
		},
		"rescan"
	);
	history.reset();
	resetEditorBenchmarkCounters();
}

describe("pointer drag frame coalescing", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("runs one move for the latest sample and flushes pointer-up synchronously", () => {
		setFixture();
		const { listeners, frames } = installWindow();

		const moves: Array<{ delta: number; total: number }> = [];
		const ends: boolean[] = [];
		const drag = createPointerDrag(() => undefined);
		drag.start(pointer(1, 0), {
			project: (event) => ({ x: event.clientX, y: 0 }),
			onMove: ({ delta, totalDelta }) => {
				moves.push({ delta: delta.x, total: totalDelta.x });
				return translateElement(element.id, delta.x, delta.y);
			},
			onEnd: ({ cancelled }) => ends.push(cancelled)
		});

		listeners.get("pointermove")?.(pointer(1, 1));
		listeners.get("pointermove")?.(pointer(1, 2));
		expect(moves).toEqual([]);

		const firstFrameId = frames.keys().next().value as number;
		const firstFrame = frames.get(firstFrameId) as FrameRequestCallback;
		frames.delete(firstFrameId);
		firstFrame(0);
		expect(moves).toEqual([{ delta: 2, total: 2 }]);
		expect(getEditorBenchmarkCounters()).toMatchObject({ documentRevisions: 1, changePublications: 1 });

		listeners.get("pointermove")?.(pointer(1, 3));
		listeners.get("pointerup")?.(pointer(1, 4));
		expect(moves).toEqual([
			{ delta: 2, total: 2 },
			{ delta: 2, total: 4 }
		]);
		expect(ends).toEqual([false]);
		expect(frames.size).toBe(0);
		expect(getEditorBenchmarkCounters()).toMatchObject({ documentRevisions: 2, changePublications: 2 });
	});

	it("discards queued movement when the pointer is canceled", () => {
		setFixture();
		const { listeners, frames } = installWindow();
		const moves: number[] = [];
		const ends: boolean[] = [];
		const drag = createPointerDrag(() => undefined);
		drag.start(pointer(1, 0), {
			project: (event) => ({ x: event.clientX, y: 0 }),
			onMove: ({ delta }) => {
				moves.push(delta.x);
			},
			onEnd: ({ cancelled }) => ends.push(cancelled)
		});

		listeners.get("pointermove")?.(pointer(1, 3));
		listeners.get("pointercancel")?.(pointer(1, 3));

		expect(moves).toEqual([]);
		expect(ends).toEqual([true]);
		expect(frames.size).toBe(0);
	});

	it("restores the transaction start when cancellation follows a flushed move", () => {
		setFixture();
		const { listeners, frames } = installWindow();
		const transaction = history.begin();
		const drag = createPointerDrag(() => undefined);
		drag.start(pointer(1, 0), {
			project: (event) => ({ x: event.clientX, y: 0 }),
			onMove: ({ delta }) => translateElement(element.id, delta.x, delta.y),
			onEnd: ({ cancelled }) => {
				if (cancelled) history.cancel(transaction);
			}
		});

		listeners.get("pointermove")?.(pointer(1, 4));
		const frameId = frames.keys().next().value as number;
		const frame = frames.get(frameId) as FrameRequestCallback;
		frames.delete(frameId);
		frame(0);
		listeners.get("pointercancel")?.(pointer(1, 4));

		expect(get(projectState).elements).toEqual([element]);
	});
});
