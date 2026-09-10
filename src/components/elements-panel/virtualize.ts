/** Fixed visual height reserved for each element row, including its gap. */
export const ELEMENT_ROW_HEIGHT = 30;

/** Number of rows rendered beyond each edge of the visible viewport. */
export const ELEMENT_ROW_OVERSCAN = 6;

/** The logical and mounted portions of a virtualized element list. */
export type VirtualWindow = {
	start: number;
	end: number;
	totalSize: number;
	indexes: number[];
};

type VirtualWindowOptions = {
	rowHeight?: number;
	overscan?: number;
	pinnedIndexes?: readonly number[];
};

/**
 * Returns the mounted row indexes for a fixed-height list and its overscan region.
 *
 * Pinned indexes stay mounted even when they are outside the viewport, which keeps
 * an active drag or inline edit connected to its DOM node.
 */
export function getVirtualWindow(
	itemCount: number,
	scrollTop: number,
	viewportHeight: number,
	{ rowHeight = ELEMENT_ROW_HEIGHT, overscan = ELEMENT_ROW_OVERSCAN, pinnedIndexes = [] }: VirtualWindowOptions = {}
): VirtualWindow {
	const count = Math.max(0, itemCount);
	const height = Math.max(1, rowHeight);
	const safeScrollTop = Math.max(0, scrollTop);
	const safeViewportHeight = Math.max(0, viewportHeight);
	const firstVisible = Math.min(count, Math.floor(safeScrollTop / height));
	const visibleCount = Math.max(1, Math.ceil(safeViewportHeight / height));
	const start = Math.max(0, firstVisible - Math.max(0, overscan));
	const end = Math.min(count, firstVisible + visibleCount + Math.max(0, overscan));
	const indexes = new Set<number>();

	for (let index = start; index < end; index += 1) indexes.add(index);
	for (const index of pinnedIndexes) {
		if (index >= 0 && index < count) indexes.add(index);
	}

	return {
		start,
		end,
		totalSize: count * height,
		indexes: [...indexes].sort((left, right) => left - right)
	};
}
