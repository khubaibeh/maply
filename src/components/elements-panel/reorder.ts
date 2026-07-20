/** Converts a visual insertion index from the reversed sidebar into project paint order. */
export function projectInsertionIndex(elementCount: number, sidebarIndex: number) {
	return elementCount - 1 - sidebarIndex;
}

/** Returns reversed paint order with an active row moved to its preview insertion index. */
export function reorderPreview<T extends { id: string }>(
	elements: readonly T[],
	elementId: string | null,
	insertionIndex: number
) {
	const result = [...elements].reverse();
	if (!elementId) return result;
	const from = result.findIndex((element) => element.id === elementId);
	if (from === -1) return result;
	const [moved] = result.splice(from, 1);
	result.splice(insertionIndex, 0, moved);
	return result;
}

/** Returns the visual range spanning every selected row and a newly Shift-selected row. */
export function getSelectionRange<T extends { id: string }>(
	elements: readonly T[],
	selectedIds: readonly string[],
	targetId: string
) {
	const targetIndex = elements.findIndex((element) => element.id === targetId);
	if (targetIndex === -1) return [];

	const selected = new Set(selectedIds);
	let first = targetIndex;
	let last = targetIndex;
	for (const [index, element] of elements.entries()) {
		if (!selected.has(element.id)) continue;
		first = Math.min(first, index);
		last = Math.max(last, index);
	}

	return elements.slice(first, last + 1);
}
