import type { Element } from "@maply/model/types";

/** Matches each name row to bindable elements and assigns all unbound elements to the blank row. */
export function elementsByNameRow(rows: readonly (readonly string[])[], elements: readonly Element[]): Element[][] {
	const names = new Set(rows.map((row) => row[0] ?? "").filter((name) => name.trim()));

	return rows.map((row) => {
		const name = row[0] ?? "";
		if (!name.trim()) {
			return elements.filter((element) => !element.bindable || !names.has(element.name));
		}
		return elements.filter((element) => element.bindable && element.name === name);
	});
}
