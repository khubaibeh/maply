import type { Tool } from "@maply/model/types";

/** Returns whether a keyboard event originated from an editable text control. */
export function isEditingText(event: KeyboardEvent): boolean {
	const target = event.target as HTMLElement | null;
	if (!target) return false;
	return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable;
}

/** Maps an arrow key to a two-dimensional editor translation. */
export function getArrowDelta(key: string, step: number) {
	switch (key) {
		case "ArrowLeft":
			return { dx: -step, dy: 0 };
		case "ArrowRight":
			return { dx: step, dy: 0 };
		case "ArrowUp":
			return { dx: 0, dy: -step };
		case "ArrowDown":
			return { dx: 0, dy: step };
		default:
			return null;
	}
}

/** Maps a single-key editor shortcut to its tool. */
export function getShortcutTool(key: string): Tool | null {
	switch (key.toLowerCase()) {
		case "v":
			return "select";
		case "h":
			return "hand";
		case "r":
			return "rect";
		case "c":
			return "circle";
		case "p":
			return "path";
		case "t":
			return "text";
		case "i":
			return "image";
		default:
			return null;
	}
}
