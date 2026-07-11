import type { Camera } from "@maply/model/types";
import { get } from "svelte/store";

import { canvasState, zoomLimits } from "../state/workspace";

function isFiniteNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value);
}

/** Clamps a zoom value to the editor's fixed camera range. */
export function clampZoom(zoom: number): number {
	return Math.min(zoomLimits.max, Math.max(zoomLimits.min, zoom));
}

/** Applies valid camera fields and clamps zoom to the active canvas limits. */
export function setCamera(camera: Partial<Camera>): void {
	canvasState.update((state) => ({
		...state,
		camera: {
			x: isFiniteNumber(camera.x) ? camera.x : state.camera.x,
			y: isFiniteNumber(camera.y) ? camera.y : state.camera.y,
			zoom: isFiniteNumber(camera.zoom) ? clampZoom(camera.zoom) : state.camera.zoom
		}
	}));
}

/** Pans the camera by canvas-space deltas. */
export function pan(dx: number, dy: number): void {
	const { camera } = get(canvasState);
	setCamera({ x: camera.x + dx, y: camera.y + dy });
}

/** Increases zoom by one standard step. */
export function zoomIn(): void {
	setCamera({ zoom: get(canvasState).camera.zoom + 0.1 });
}

/** Decreases zoom by one standard step. */
export function zoomOut(): void {
	setCamera({ zoom: get(canvasState).camera.zoom - 0.1 });
}

/** Resets camera zoom while retaining its pan position. */
export function resetZoom(): void {
	setCamera({ zoom: 1 });
}

/** Resets camera pan and zoom. */
export function resetCamera(): void {
	canvasState.update((state) => ({ ...state, camera: { x: 0, y: 0, zoom: 1 } }));
}

/** Centers the canvas in a viewport and resets zoom. */
export function centerCamera(containerWidth: number, containerHeight: number): void {
	const canvas = get(canvasState);
	setCamera({
		x: -containerWidth / 2 + canvas.x + canvas.width / 2,
		y: -containerHeight / 2 + canvas.y + canvas.height / 2,
		zoom: 1
	});
}
