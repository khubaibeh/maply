export type SortDirection = "ascending" | "descending";

export interface GridSort {
	column: number;
	direction: SortDirection;
}

/** Returns row indexes in their requested column order, retaining the blank-name row at the end. */
export function sortedRowIndexes(
	rows: readonly (readonly string[])[],
	indexes: readonly number[],
	sort: GridSort | null
): number[] {
	if (!sort) return [...indexes];

	const direction = sort.direction === "ascending" ? 1 : -1;
	return [...indexes].sort((leftIndex, rightIndex) => {
		const left = rows[leftIndex] ?? [];
		const right = rows[rightIndex] ?? [];
		const leftIsBlankName = !left[0]?.trim();
		const rightIsBlankName = !right[0]?.trim();
		if (leftIsBlankName !== rightIsBlankName) return leftIsBlankName ? 1 : -1;

		const compared = (left[sort.column] ?? "").localeCompare(right[sort.column] ?? "", undefined, {
			numeric: true,
			sensitivity: "base"
		});
		return compared === 0 ? leftIndex - rightIndex : compared * direction;
	});
}
