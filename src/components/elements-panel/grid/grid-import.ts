import { applyMatrix } from "./grid-apply";
import type { CellAddr } from "./grid-model";
import type { IngestWarning } from "./ingest/types";

export interface GridImportResult {
	headers: string[];
	rows: string[][];
	warnings: IngestWarning[];
}

/** Applies an imported matrix, optionally taking its first row as editable column headers. */
export function applyImportMatrix(
	headers: string[],
	rows: string[][],
	matrix: string[][],
	anchor: CellAddr,
	hasHeader: boolean
): GridImportResult {
	const importedHeaders = hasHeader ? (matrix[0] ?? []) : [];
	const dataRows = hasHeader ? matrix.slice(1) : matrix;
	const nextHeaders = [...headers];
	while (nextHeaders.length < anchor.c + importedHeaders.length) nextHeaders.push("");

	for (const [offset, value] of importedHeaders.entries()) {
		const column = anchor.c + offset;
		if (column !== 0) nextHeaders[column] = value;
	}

	const result = applyMatrix(nextHeaders, rows, dataRows, anchor);
	return result;
}
