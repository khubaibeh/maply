import type { Element } from "../domain/elements";

let clipboardElement = $state<Element | null>(null);

export function copyElement(element: Element) {
	// Clipboard entries must not retain reactive references to live canvas elements.
	clipboardElement = $state.snapshot(element) as Element;
}

export function getClipboardElement(): Element | null {
	// Pasted elements are cloned from a snapshot so later edits cannot mutate the clipboard.
	return clipboardElement ? ($state.snapshot(clipboardElement) as Element) : null;
}

export function clearClipboard() {
	clipboardElement = null;
}
