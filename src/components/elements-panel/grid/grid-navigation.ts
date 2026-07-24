import type { CellAddr } from "./grid-model";

export interface NavigationResult {
	next: CellAddr;
	needsNewRow: boolean;
}

export interface GridDimensions {
	rows: number;
	cols: number;
}

/** Navigate grid based on key press.
 *
 * - Arrow keys: move in direction, clamp at edges
 * - Tab: move right, wrap to next row's first col
 * - Shift+Tab: move left, wrap to prev row's last col
 * - Enter: move down, signal needsNewRow if at last row
 * - Shift+Enter: move up
 */
export function navigate(current: CellAddr, key: string, dims: GridDimensions, shift: boolean): NavigationResult {
	const next = { ...current };
	let needsNewRow = false;

	switch (key) {
		case "ArrowUp":
			next.r = Math.max(0, next.r - 1);
			break;

		case "ArrowDown":
			next.r = Math.min(dims.rows - 1, next.r + 1);
			break;

		case "ArrowLeft":
			next.c = Math.max(0, next.c - 1);
			break;

		case "ArrowRight":
			next.c = Math.min(dims.cols - 1, next.c + 1);
			break;

		case "Tab":
			if (shift) {
				// Shift+Tab: go left, wrap to prev row's last col
				if (next.c > 0) {
					next.c--;
				} else if (next.r > 0) {
					next.r--;
					next.c = dims.cols - 1;
				}
			} else {
				// Tab: go right, wrap to next row's first col
				if (next.c < dims.cols - 1) {
					next.c++;
				} else if (next.r < dims.rows - 1) {
					next.r++;
					next.c = 0;
				} else {
					// At last cell, signal to create new row
					needsNewRow = true;
				}
			}
			break;

		case "Enter":
			if (shift) {
				// Shift+Enter: go up
				next.r = Math.max(0, next.r - 1);
			} else {
				// Enter: go down, signal needsNewRow if at last
				if (next.r < dims.rows - 1) {
					next.r++;
				} else {
					needsNewRow = true;
				}
			}
			break;
	}

	return { next, needsNewRow };
}
