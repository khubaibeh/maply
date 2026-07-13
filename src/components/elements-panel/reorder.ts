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
