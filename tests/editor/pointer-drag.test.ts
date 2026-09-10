import { afterEach, describe, expect, it, vi } from "vitest";

import { createPointerDrag } from "../../src/components/canvas/interaction/pointer-drag.svelte";

vi.mock("svelte", () => ({ onDestroy: vi.fn() }));

type Listener = (event: PointerEvent) => void;

function pointer(pointerId: number, x: number): PointerEvent {
	return { pointerId, clientX: x } as PointerEvent;
}

describe("pointer drag frame coalescing", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("runs one move for the latest sample and flushes pointer-up synchronously", () => {
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

		const moves: Array<{ delta: number; total: number }> = [];
		const ends: boolean[] = [];
		const drag = createPointerDrag();
		drag.start(pointer(1, 0), {
			project: (event) => ({ x: event.clientX, y: 0 }),
			onMove: ({ delta, totalDelta }) => {
				moves.push({ delta: delta.x, total: totalDelta.x });
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

		listeners.get("pointermove")?.(pointer(1, 3));
		listeners.get("pointerup")?.(pointer(1, 4));
		expect(moves).toEqual([
			{ delta: 2, total: 2 },
			{ delta: 2, total: 4 }
		]);
		expect(ends).toEqual([false]);
		expect(frames.size).toBe(0);
	});
});
