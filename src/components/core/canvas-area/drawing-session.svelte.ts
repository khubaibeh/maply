import { Editor } from "editor";
import { fromStore } from "svelte/store";

import type { DrawingSession, DrawingTool } from "./drawing";
import { clampToCanvas } from "./path-drawing";

/** Owns the lifecycle and preview of one drag-created shape. */
export function createDrawingSession() {
	const canvas = fromStore(Editor.state.canvas);
	const project = fromStore(Editor.state.project);
	const state = $state({ session: null as DrawingSession | null });
	const preview = $derived.by(() => {
		if (!state.session) return null;
		const box = Editor.geometry.shapeDragBox(
			state.session.start,
			state.session.current,
			state.session.tool === "rect" && state.session.square
		);
		if (!box) return null;
		if (state.session.tool !== "circle") return { type: state.session.tool, ...box };
		const diameter = Math.min(box.width, box.height);
		return {
			type: "circle" as const,
			cx: box.x + diameter / 2,
			cy: box.y + diameter / 2,
			r: diameter / 2
		};
	});

	function start(tool: DrawingTool, point: { x: number; y: number }, square: boolean) {
		state.session = { tool, start: point, current: point, square };
	}

	function move(point: { x: number; y: number }, square: boolean) {
		if (!state.session) return;
		state.session = { ...state.session, current: clampToCanvas(point, canvas.current), square };
	}

	function end(point: { x: number; y: number } | null, square: boolean) {
		if (!state.session) return;
		const session = state.session;
		const endPoint = point ? clampToCanvas(point, canvas.current) : session.current;
		state.session = null;
		const elements = project.current.elements;
		const element =
			session.tool === "rect"
				? Editor.create.rectFromDrag(session.start, endPoint, elements, square)
				: session.tool === "circle"
					? Editor.create.circleFromDrag(session.start, endPoint, elements)
					: session.tool === "text"
						? Editor.create.textFromDrag(session.start, endPoint, elements)
						: Editor.create.imageFromDrag(session.start, endPoint, elements);
		if (!element) return;
		Editor.element.add(element);
		Editor.actions.tool.set("select");
	}

	function cancel() {
		state.session = null;
	}

	return { state, preview: () => preview, start, move, end, cancel };
}
