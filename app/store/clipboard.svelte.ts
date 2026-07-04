import type { Element } from "../domain/elements";

let clipboardElements = $state<Element[]>([]);

export function copyElements(elements: Element[]) {
	// Clipboard entries must not retain reactive references to live canvas elements.
	clipboardElements = elements.map((element) => $state.snapshot(element) as Element);
}

export function getClipboardElements(): Element[] {
	// Pasted elements are cloned from a snapshot so later edits cannot mutate the clipboard.
	return clipboardElements.map((element) => $state.snapshot(element) as Element);
}

export function clearClipboard() {
	clipboardElements = [];
}
