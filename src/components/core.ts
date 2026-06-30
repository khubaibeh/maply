import type { Tool } from "@app/types";

export const LEFT_SIDEBAR_MIN_WIDTH = 240;
export const RIGHT_SIDEBAR_MIN_WIDTH = 288;

export function isEditingText(event: KeyboardEvent): boolean {
	const target = event.target as HTMLElement | null;
	if (!target) return false;
	return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable;
}

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
