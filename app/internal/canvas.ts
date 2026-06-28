import type { Camera } from "../domain/project";

export const CONSTANTS = {
	width: 800,
	height: 800,
	zoom: 1,
	min_zoom: 0.1,
	max_zoom: 5
};

export function clampZoom(value: number): number {
	return Math.min(CONSTANTS.max_zoom, Math.max(CONSTANTS.min_zoom, value));
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
