import type { Point } from "@maply/model/types";
import { Editor } from "editor";
import { fromStore } from "svelte/store";

import { movePath, type PathSession } from "./path-drawing";

const CLOSE_THRESHOLD_SCREEN_PX = 12;

/** Owns path draft transitions, close detection, and commit behavior. */
export function createPathSession() {
	const canvas = fromStore(Editor.state.canvas);
	const project = fromStore(Editor.state.project);
	const state = $state({ session: null as PathSession | null });

	function move(point: Point, snap = false) {
		if (!state.session) return;
		state.session = movePath(
			state.session,
			point,
			canvas.current,
			CLOSE_THRESHOLD_SCREEN_PX / canvas.current.camera.zoom,
			snap ? Editor.geometry.snapPathSegment : undefined
		);
	}

	function commit() {
		if (!state.session) return;
		const points = state.session.points;
		state.session = null;
		const element = Editor.create.pathFromPoints(points, true, project.current.elements);
		if (!element) return;
		Editor.element.add(element);
		Editor.actions.tool.set("select");
	}

	function close() {
		if (state.session && state.session.points.length >= 3) commit();
	}

	function add(point: Point, snap = false) {
		if (!state.session) {
			state.session = { points: [point], current: point, nearFirst: false };
			return;
		}
		move(point, snap);
		if (!state.session) return;
		if (state.session.nearFirst) return close();
		state.session = { ...state.session, points: [...state.session.points, state.session.current] };
		move(point, snap);
	}

	function cancel() {
		state.session = null;
	}

	return { state, move, add, close, cancel };
}
