import { get } from "svelte/store";

import { minimumCanvasSizeState } from "../state/document";
import { canvasState } from "../state/workspace";

function sanitizeSize(value: number, minimum: number) {
	return Math.max(minimum, Math.round(value));
}

/** Updates the canvas dimensions. */
export function setSize(width: number, height: number): void {
	const min = get(minimumCanvasSizeState);
	canvasState.update((state) => ({
		...state,
		width: sanitizeSize(width, min.width),
		height: sanitizeSize(height, min.height)
	}));
}

/** Updates the complete canvas frame. */
export function setFrame(x: number, y: number, width: number, height: number): void {
	const min = get(minimumCanvasSizeState);
	canvasState.update((state) => ({
		...state,
		x: Math.round(x),
		y: Math.round(y),
		width: sanitizeSize(width, min.width),
		height: sanitizeSize(height, min.height)
	}));
}

/** Updates the canvas background color. */
export function setColor(color: string): void {
	canvasState.update((state) => ({ ...state, color }));
}

/** Updates the canvas origin. */
export function setPosition(x: number, y: number): void {
	canvasState.update((state) => ({ ...state, x, y }));
}
