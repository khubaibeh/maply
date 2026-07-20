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

/** Owns one active window pointer-drag lifecycle for a Svelte component. */
export function createPointerDrag() {
	let active: ActiveDrag | null = null;

	function removeListeners() {
		window.removeEventListener("pointermove", move);
		window.removeEventListener("pointerup", end);
		window.removeEventListener("pointercancel", cancel);
	}

	function stop(cancelled: boolean, event: PointerEvent | null) {
		if (!active) return;
		const completed = active;
		active = null;
		removeListeners();
		completed.callbacks.onEnd?.({ cancelled, didMove: completed.didMove, event });
	}

	function move(event: PointerEvent) {
		if (!active || event.pointerId !== active.pointerId) return;
		const current = active.callbacks.project(event);
		if (!current) return;

		const measured = measureDrag(active.start, active.previous, current);
		if (measured.delta.x === 0 && measured.delta.y === 0) return;
		active.didMove = true;
		const consumedDelta = active.callbacks.onMove({ current, ...measured, event });
		active.previous = consumedDelta
			? { x: active.previous.x + consumedDelta.x, y: active.previous.y + consumedDelta.y }
			: current;
	}

	function end(event: PointerEvent) {
		if (!active || event.pointerId !== active.pointerId) return;
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
