import { Editor } from "editor";
import { fromStore } from "svelte/store";

import { canSelectOnCanvas } from "./element-selection";
import { createPointerDrag } from "./pointer-drag.svelte";
import { clientToSvgPoint, getSvgRoot } from "./svg";

/** Centralizes selection and movement policy for canvas element pointer targets. */
export function createElementMove() {
	const project = fromStore(Editor.state.project);
	const tool = fromStore(Editor.state.tool);
	const drag = createPointerDrag();
	const state = $state({ isDragging: false });

	function start(event: PointerEvent, id: string) {
		if (event.button !== 0 || tool.current.activeTool !== "select") return;
		const element = project.current.elements.find((element) => element.id === id);
		if (element && !canSelectOnCanvas(element)) {
			event.stopPropagation();
			return;
		}
		event.stopPropagation();
		drag.cancel();

		const additive = event.ctrlKey || event.metaKey;
		const wasSelected = project.current.selectedElementIds.includes(id);
		if (additive) {
			event.preventDefault();
			if (!wasSelected) {
				Editor.selection.select(id, true);
				return;
			}
		} else if (!wasSelected) {
			Editor.selection.select(id);
		}

		const selectedIds = [...project.current.selectedElementIds];
		const svg = getSvgRoot(event.target);
		if (!svg) return;
		const toggleId = additive && wasSelected ? id : null;
		const collapseId = !additive && wasSelected && selectedIds.length > 1 ? id : null;
		const ids = wasSelected && selectedIds.length > 1 ? selectedIds : [id];

		drag.start(event, {
			project: (pointerEvent) => clientToSvgPoint(svg, pointerEvent.clientX, pointerEvent.clientY),
			onMove: ({ delta }) => {
				state.isDragging = true;
				return ids.length > 1
					? Editor.element.translateAll(ids, delta.x, delta.y)
					: Editor.element.translate(ids[0], delta.x, delta.y);
			},
			onEnd: ({ cancelled, didMove }) => {
				state.isDragging = false;
				if (cancelled || didMove) return;
				if (toggleId) Editor.selection.select(toggleId, true);
				else if (collapseId) Editor.selection.select(collapseId);
			}
		});
	}

	return { start, state };
}
