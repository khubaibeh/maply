import type { Element } from "@maply/model/types";

export const elementsColumn = "elements";

export type GridColumn = number | typeof elementsColumn;
export type GridFilters = ReadonlyMap<GridColumn, ReadonlySet<string>>;

function cellValue(value: string | undefined): string {
	return value?.trim() ? value : "";
}

/** Returns the distinct filter values for a column, with blank first. */
export function filterValues(
	rows: readonly (readonly string[])[],
	rowElements: readonly (readonly Element[])[],
	column: GridColumn,
	filters: GridFilters = new Map()
): string[] {
	const values = new Set<string>();
	const otherFilters = new Map(filters);
	otherFilters.delete(column);
	const matchingRows = filteredRowIndexes(rows, rowElements, otherFilters);
	for (const index of matchingRows) {
		if (column === elementsColumn) {
			const elements = rowElements[index] ?? [];
			if (elements.length === 0) values.add("");
			for (const element of elements) values.add(element.name);
		} else {
			values.add(cellValue(rows[index]?.[column]));
		}
	}
	for (const value of filters.get(column) ?? []) values.add(value);
	return [...values].sort((left, right) => {
		if (!left) return -1;
		if (!right) return 1;
		return left.localeCompare(right);
	});
}

/** Returns row indexes matching every active filter, with the blank-name bucket always included. */
export function filteredRowIndexes(
	rows: readonly (readonly string[])[],
	rowElements: readonly (readonly Element[])[],
	filters: GridFilters
): number[] {
	return rows.flatMap((row, index) => {
		if (!row[0]?.trim()) return [index];
		for (const [column, selected] of filters) {
			if (column === elementsColumn) {
				const values = (rowElements[index] ?? []).map((element) => element.name);
				if (!values.some((value) => selected.has(value)) && !(values.length === 0 && selected.has(""))) {
					return [];
				}
			} else if (!selected.has(cellValue(row[column]))) {
				return [];
			}
		}
		return [index];
	});
}

/** Narrows a filter option list without changing its applied filter. */
export function searchedFilterValues(values: readonly string[], query: string): string[] {
	const normalized = query.trim().toLocaleLowerCase();
	if (!normalized) return [...values];
	return values.filter((value) => (value || "(Blank)").toLocaleLowerCase().includes(normalized));
}
