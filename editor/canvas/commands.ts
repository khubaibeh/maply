import { canvasState } from "editor/state/workspace";

function sanitizeSize(value: number) {
	return Math.max(1, Math.round(value));
}

/** Updates the canvas dimensions. */
export function setSize(width: number, height: number): void {
	canvasState.update((state) => ({
		...state,
		width: sanitizeSize(width),
		height: sanitizeSize(height)
	}));
}

/** Updates the complete canvas frame. */
export function setFrame(x: number, y: number, width: number, height: number): void {
	canvasState.update((state) => ({
		...state,
		x: Math.round(x),
		y: Math.round(y),
		width: sanitizeSize(width),
		height: sanitizeSize(height)
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
