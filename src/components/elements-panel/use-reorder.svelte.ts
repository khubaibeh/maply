import type { Element } from "@maply/model/types";
import { Editor } from "editor";
import { onDestroy } from "svelte";
import { fromStore } from "svelte/store";

import { getSelectionRange, projectInsertionIndex, reorderPreview } from "./reorder";

type ReorderState = {
	elementId: string;
	fromIndex: number;
	insertionIndex: number;
	clientY: number;
};

type PendingState = {
	elementId: string;
	fromIndex: number;
	clientY: number;
	timer: ReturnType<typeof setTimeout>;
};

type ReorderOptions = {
	list: () => HTMLElement | null;
	viewport: () => HTMLElement | null;
};

/** Owns delayed activation, preview ordering, auto-scroll, and cleanup for the elements panel. */
export function createElementReorder({ list, viewport }: ReorderOptions) {
	const project = fromStore(Editor.state.project);
	let active = $state<ReorderState | null>(null);
	let pending: PendingState | null = null;
	let frame: number | null = null;
	let velocity = 0;

	function preview(elements: Element[]) {
		return reorderPreview(elements, active?.elementId ?? null, active?.insertionIndex ?? 0);
	}

	function insertionIndex(clientY: number) {
		const container = list();
		if (!container || !active) return active?.insertionIndex ?? 0;
		const rows = Array.from(container.querySelectorAll<HTMLElement>("[data-element-row]")).filter(
			(row) => row.dataset.elementId !== active?.elementId
		);
		for (const [index, row] of rows.entries()) {
			const bounds = row.getBoundingClientRect();
			if (clientY < bounds.top + bounds.height / 2) return index;
		}
		return rows.length;
	}

	function stopAutoScroll() {
		velocity = 0;
		if (frame !== null && typeof cancelAnimationFrame !== "undefined") cancelAnimationFrame(frame);
		frame = null;
	}

	function scroll() {
		frame = null;
		const target = viewport();
		if (!target || !active || velocity === 0) return;
		target.scrollBy({ top: velocity });
		active.insertionIndex = insertionIndex(active.clientY);
		frame = requestAnimationFrame(scroll);
	}

	function updateAutoScroll(clientY: number) {
		const target = viewport();
		if (!target || !active) return;
		const bounds = target.getBoundingClientRect();
		const edge = 36;
		const max = 10;
		velocity =
			clientY < bounds.top + edge
				? -max * (1 - (clientY - bounds.top) / edge)
				: clientY > bounds.bottom - edge
					? max * (1 - (bounds.bottom - clientY) / edge)
					: 0;
		if (velocity !== 0 && frame === null) frame = requestAnimationFrame(scroll);
	}

	function clearPending() {
		if (!pending) return;
		clearTimeout(pending.timer);
		pending = null;
		if (typeof window === "undefined") return;
		window.removeEventListener("pointermove", movePending);
		window.removeEventListener("pointerup", clearPending);
		window.removeEventListener("pointercancel", clearPending);
	}

	function removeActiveListeners() {
		if (typeof window === "undefined") return;
		window.removeEventListener("pointermove", move);
		window.removeEventListener("pointerup", commit);
		window.removeEventListener("pointercancel", cancel);
		stopAutoScroll();
	}

	function activate() {
		if (!pending) return;
		const next = pending;
		pending = null;
		active = {
			elementId: next.elementId,
			fromIndex: next.fromIndex,
			insertionIndex: next.fromIndex,
			clientY: next.clientY
		};
		window.removeEventListener("pointermove", movePending);
		window.removeEventListener("pointerup", clearPending);
		window.removeEventListener("pointercancel", clearPending);
		window.addEventListener("pointermove", move);
		window.addEventListener("pointerup", commit);
		window.addEventListener("pointercancel", cancel);
	}

	function movePending(event: PointerEvent) {
		if (pending) pending.clientY = event.clientY;
	}

	function move(event: PointerEvent) {
		if (!active) return;
		active.clientY = event.clientY;
		active.insertionIndex = insertionIndex(event.clientY);
		updateAutoScroll(event.clientY);
	}

	function commit() {
		if (!active) return;
		const count = project.current.elements.length;
		const from = projectInsertionIndex(count, active.fromIndex);
		const to = projectInsertionIndex(count, active.insertionIndex);
		if (from !== to) Editor.element.reorder(from, to);
		active = null;
		removeActiveListeners();
	}

	function cancel() {
		clearPending();
		active = null;
		removeActiveListeners();
	}

	function start(event: PointerEvent, elementId: string, index: number) {
		if (event.button !== 0 || event.target instanceof HTMLInputElement) return;
		clearPending();
		pending = {
			elementId,
			fromIndex: index,
			clientY: event.clientY,
			timer: setTimeout(activate, 220)
		};
		window.addEventListener("pointermove", movePending);
		window.addEventListener("pointerup", clearPending);
		window.addEventListener("pointercancel", clearPending);
	}

	function select(event: PointerEvent, elementId: string, rows: readonly Element[]) {
		if (event.button !== 0 || event.target instanceof HTMLInputElement) return;
		if (event.shiftKey && project.current.selectedElementIds.length > 0) {
			const selected = getSelectionRange(rows, project.current.selectedElementIds, elementId);
			if (selected.length > 0) {
				Editor.selection.selectMany(selected.map((element) => element.id));
				return;
			}
		}
		Editor.selection.select(elementId, event.ctrlKey || event.metaKey || event.shiftKey);
	}

	onDestroy(cancel);

	return {
		preview,
		start,
		select,
		isActive: (id: string) => active?.elementId === id
	};
}
