import type { Camera } from "$lib/editor/model/project";

export const DEFAULT_CANVAS_WIDTH = 800;
export const DEFAULT_CANVAS_HEIGHT = 800;
export const DEFAULT_ZOOM = 1;
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 5;

export function clampZoom(value: number): number {
	return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

export function validNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value);
}

export function sanitizeCanvasSize(value: number): number {
	return Math.max(1, Math.round(value));
}

export function mergeCamera(current: Camera, next: Partial<Camera>): Camera {
	return {
		x: validNumber(next.x) ? next.x : current.x,
		y: validNumber(next.y) ? next.y : current.y,
		zoom: validNumber(next.zoom) ? clampZoom(next.zoom) : current.zoom
	};
}
