import { Editor } from "editor";
import { fromStore } from "svelte/store";

import { canvasElementPointerAction } from "./element-selection";
import { createPointerDrag } from "./pointer-drag.svelte";
import { clientToSvgPoint, getSvgRoot } from "./svg";

/** Centralizes selection and movement policy for canvas element pointer targets. */
export function createElementMove() {
	const interaction = fromStore(Editor.state.interaction);
	const tool = fromStore(Editor.state.tool);
	const drag = createPointerDrag();
	const state = $state({ isDragging: false });

	function start(event: PointerEvent, id: string) {
		if (event.button !== 0 || tool.current.activeTool !== "select") return;
		const element = Editor.document.get(id);
		if (element && canvasElementPointerAction(element) === "clear-selection") {
			event.stopPropagation();
			Editor.selection.select(null);
			return;
		}
		event.stopPropagation();
		drag.cancel();

		const additive = event.ctrlKey || event.metaKey;
		const wasSelected = interaction.current.selectedElementIds.includes(id);
		if (additive) {
			event.preventDefault();
			if (!wasSelected) {
				Editor.selection.select(id, true);
				return;
			}
		} else if (!wasSelected) {
			Editor.selection.select(id);
		}

		const selectedIds = [...interaction.current.selectedElementIds];
		const svg = getSvgRoot(event.target);
		if (!svg) return;
		const toggleId = additive && wasSelected ? id : null;
		const collapseId = !additive && wasSelected && selectedIds.length > 1 ? id : null;
		const ids = wasSelected && selectedIds.length > 1 ? selectedIds : [id];

		drag.cancel();
		const historyTransaction = Editor.history.begin();
		const started = drag.start(event, {
			project: (pointerEvent) => clientToSvgPoint(svg, pointerEvent.clientX, pointerEvent.clientY),
			onMove: ({ delta }) => {
				state.isDragging = true;
				return ids.length > 1
					? Editor.element.translateAll(ids, delta.x, delta.y)
					: Editor.element.translate(ids[0], delta.x, delta.y);
			},
			onEnd: ({ cancelled, didMove }) => {
				state.isDragging = false;
				if (cancelled) Editor.history.cancel(historyTransaction);
				else Editor.history.commit(historyTransaction);
				if (cancelled || didMove) return;
				if (toggleId) Editor.selection.select(toggleId, true);
				else if (collapseId) Editor.selection.select(collapseId);
			}
		});
		if (!started) Editor.history.cancel(historyTransaction);
	}

	return { start, state };
}
