import type { Point } from "@maply/model/types";
import { onDestroy } from "svelte";

import { measureDrag, type DragMove } from "./drag";

type DragEnd = {
	cancelled: boolean;
	didMove: boolean;
	event: PointerEvent | null;
};

type DragCallbacks = {
	project(event: PointerEvent): Point | null;
	onMove(move: DragMove): Point | void;
	onEnd?(end: DragEnd): void;
};

type ActiveDrag = {
	pointerId: number;
	start: Point;
	previous: Point;
	didMove: boolean;
	callbacks: DragCallbacks;
};

type PendingMove = {
	current: Point;
	event: PointerEvent;
};

/** Owns one active window pointer-drag lifecycle for a Svelte component. */
export function createPointerDrag() {
	let active: ActiveDrag | null = null;
	let pending: PendingMove | null = null;
	let frame: number | null = null;

	function cancelFrame() {
		if (frame === null) return;
		cancelAnimationFrame(frame);
		frame = null;
	}

	function removeListeners() {
		window.removeEventListener("pointermove", move);
		window.removeEventListener("pointerup", end);
		window.removeEventListener("pointercancel", cancel);
	}

	function flush() {
		const completed = active;
		const move = pending;
		pending = null;
		if (!completed || !move) return;

		const measured = measureDrag(completed.start, completed.previous, move.current);
		if (measured.delta.x === 0 && measured.delta.y === 0) return;
		completed.didMove = true;
		const consumedDelta = completed.callbacks.onMove({ current: move.current, ...measured, event: move.event });
		completed.previous = consumedDelta
			? { x: completed.previous.x + consumedDelta.x, y: completed.previous.y + consumedDelta.y }
			: move.current;
	}

	function queue(move: PendingMove) {
		pending = move;
		if (frame !== null) return;
		frame = requestAnimationFrame(() => {
			frame = null;
			flush();
		});
	}

	function stop(cancelled: boolean, event: PointerEvent | null) {
		if (!active) return;
		const completed = active;
		active = null;
		cancelFrame();
		pending = null;
		removeListeners();
		completed.callbacks.onEnd?.({ cancelled, didMove: completed.didMove, event });
	}

	function move(event: PointerEvent) {
		if (!active || event.pointerId !== active.pointerId) return;
		const current = active.callbacks.project(event);
		if (!current) return;
		queue({ current, event });
	}

	function end(event: PointerEvent) {
		if (!active || event.pointerId !== active.pointerId) return;
		const current = active.callbacks.project(event);
		if (current) queue({ current, event });
		cancelFrame();
		flush();
		stop(false, event);
	}

	function cancel(event: PointerEvent) {
		if (!active || event.pointerId !== active.pointerId) return;
		stop(true, event);
	}

	function start(event: PointerEvent, callbacks: DragCallbacks) {
		stop(true, null);
		const point = callbacks.project(event);
		if (!point) return false;
		active = {
			pointerId: event.pointerId,
			start: point,
			previous: point,
			didMove: false,
			callbacks
		};
		window.addEventListener("pointermove", move);
		window.addEventListener("pointerup", end);
		window.addEventListener("pointercancel", cancel);
		return true;
	}

	onDestroy(() => stop(true, null));

	return { start, cancel: () => stop(true, null) };
}
