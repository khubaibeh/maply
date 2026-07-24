import { canSelectOnCanvas } from "@components/canvas/interaction/element-selection";
import {
	exceedsMarqueeThreshold,
	getMarqueeBounds,
	intersectsBounds,
	resolveMarqueeSelection,
	type MarqueeBounds
} from "@components/canvas/interaction/marquee";
import { createPointerDrag } from "@components/canvas/interaction/pointer-drag.svelte";
import { clientToSvgPoint } from "@components/canvas/interaction/svg";
import type { Element } from "@maply/model/types";
import { Editor } from "editor";
import { fromStore } from "svelte/store";

const MIN_MARQUEE_SCREEN_PX = 3;

/** Owns temporary marquee state and commits enclosed element selection when its drag ends. */
export function createMarqueeSelection() {
	const canvas = fromStore(Editor.state.canvas);
	const project = fromStore(Editor.state.project);
	const drag = createPointerDrag();
	const state = $state({
		active: false,
		box: null as MarqueeBounds | null,
		candidates: [] as Element[]
	});

	function start(event: PointerEvent, svg: SVGSVGElement): boolean {
		const startPoint = clientToSvgPoint(svg, event.clientX, event.clientY);
		if (!startPoint) return false;
		const additive = event.ctrlKey || event.metaKey;
		state.active = true;
		state.box = null;
		state.candidates = [];

		const started = drag.start(event, {
			project: (pointerEvent) => clientToSvgPoint(svg, pointerEvent.clientX, pointerEvent.clientY),
			onMove: ({ current, totalDelta }) => {
				if (!exceedsMarqueeThreshold(totalDelta, canvas.current.camera.zoom, MIN_MARQUEE_SCREEN_PX)) return;
				const box = getMarqueeBounds(startPoint, current);
				state.box = box;
				state.candidates = project.current.elements.filter(
					(element) =>
						canSelectOnCanvas(element) && intersectsBounds(box, Editor.geometry.elementBounds(element))
				);
			},
			onEnd: ({ cancelled }) => {
				const box = state.box;
				const candidateIds = state.candidates.map((element) => element.id);
				state.active = false;
				state.box = null;
				state.candidates = [];
				const selection = resolveMarqueeSelection(
					project.current.selectedElementIds,
					candidateIds,
					additive,
					box !== null,
					cancelled
				);
				if (selection !== null) Editor.selection.selectMany(selection);
			}
		});

		if (!started) state.active = false;
		return started;
	}

	return { state, start, cancel: drag.cancel };
}
