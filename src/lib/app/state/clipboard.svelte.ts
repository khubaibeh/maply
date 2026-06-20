import type { Element } from "../domain/elements";

let clipboardElement = $state<Element | null>(null);

export function copyElement(element: Element) {
	clipboardElement = $state.snapshot(element) as Element;
}

export function getClipboardElement(): Element | null {
	return clipboardElement ? ($state.snapshot(clipboardElement) as Element) : null;
}

export function clearClipboard() {
	clipboardElement = null;
}
