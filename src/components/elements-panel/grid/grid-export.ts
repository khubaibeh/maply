import type { Element } from "@maply/model/types";

/** Serializes grid values and their matched element names as a CSV file. */
export function nameMappingsCsv(
	headers: readonly string[],
	rows: readonly (readonly string[])[],
	rowElements: readonly (readonly Element[])[]
): string {
	const csvRows = [
		[...headers, "Elements"],
		...rows.map((row, index) => [
			...headers.map((_, column) => row[column] ?? ""),
			(rowElements[index] ?? []).map((element) => element.name).join(";")
		])
	];
	return csvRows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

function csvCell(value: string): string {
	return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}
