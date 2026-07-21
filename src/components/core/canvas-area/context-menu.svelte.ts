import type { Point } from "@maply/model/types";
import { Editor } from "editor";
import type { SelectionOrder } from "editor/types";
import { fromStore } from "svelte/store";

/** Owns canvas context-menu targeting, availability, and command dispatch. */
export function createCanvasContextMenu() {
	const project = fromStore(Editor.state.project);
	const state = $state({
		open: false,
		target: "empty" as "element" | "empty",
		elementId: null as string | null,
		point: null as Point | null
	});

	function handle(event: MouseEvent, point: Point | null) {
		state.point = point;
		const node = event.target instanceof Element ? event.target.closest("[data-canvas-element]") : null;
		const id = node?.getAttribute("data-canvas-element") ?? null;
		if (id) {
			if (!project.current.selectedElementIds.includes(id)) Editor.selection.select(id);
			state.target = "element";
			state.elementId = id;
			return;
		}
		if (project.current.selectedElementIds.length > 0) Editor.selection.select(null);
		state.target = "empty";
		state.elementId = null;
	}

	function dismiss(event: PointerEvent) {
		if (event.button !== 0 || !state.open) return;
		if (event.target instanceof Element && event.target.closest('[data-slot="context-menu-content"]')) return;
		state.open = false;
	}

	function copy() {
		if (!state.elementId) return;
		const ids = project.current.selectedElementIds.includes(state.elementId)
			? project.current.selectedElementIds
			: [state.elementId];
		Editor.clipboard.copy(project.current.elements.filter((element) => ids.includes(element.id)));
		state.open = false;
	}

	function remove() {
		if (!state.elementId) return;
		const ids = project.current.selectedElementIds.includes(state.elementId)
			? project.current.selectedElementIds
			: [state.elementId];
		void Editor.element.delete(ids);
		state.open = false;
	}

	function order(action: SelectionOrder) {
		const ids = orderingIds();
		if (ids.length === 0) return;
		if (action === "front") Editor.element.moveToFront(ids);
		else if (action === "forward") Editor.element.moveForward(ids);
		else if (action === "backward") Editor.element.moveBackward(ids);
		else Editor.element.moveToBack(ids);
		state.open = false;
	}

	function paste() {
		if (Editor.clipboard.get().length === 0) return;
		void Editor.clipboard.paste(state.point ?? undefined);
		state.open = false;
	}

	function selectAll() {
		Editor.selection.selectAll();
		state.open = false;
	}

	function orderingIds() {
		if (!state.elementId) return [];
		return project.current.selectedElementIds.includes(state.elementId)
			? project.current.selectedElementIds
			: [state.elementId];
	}

	function canOrder(action: SelectionOrder) {
		return Editor.element.canReorder(project.current.elements, orderingIds(), action);
	}

	return {
		state,
		handle,
		dismiss,
		copy,
		remove,
		bringToFront: () => order("front"),
		bringForward: () => order("forward"),
		sendBackward: () => order("backward"),
		sendToBack: () => order("back"),
		paste,
		selectAll,
		hasClipboardElement: () => Editor.clipboard.get().length > 0,
		canBringToFront: () => canOrder("front"),
		canBringForward: () => canOrder("forward"),
		canSendBackward: () => canOrder("backward"),
		canSendToBack: () => canOrder("back")
	};
}
