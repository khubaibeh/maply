import { applyMatrix } from "./grid-apply";
import { growToFit } from "./grid-model";
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
	const width = Math.max(importedHeaders.length, ...dataRows.map((row) => row.length));
	const grown =
		width === 0
			? { headers, rows }
			: growToFit(headers, rows, {
					r: Math.max(rows.length - 1, anchor.r + dataRows.length - 1),
					c: anchor.c + width - 1
				});
	const nextHeaders = [...grown.headers];

	for (const [offset, value] of importedHeaders.entries()) {
		const column = anchor.c + offset;
		if (column !== 0) nextHeaders[column] = value;
	}

	const result = applyMatrix(nextHeaders, grown.rows, dataRows, anchor);
	return { headers: nextHeaders, rows: result.rows, warnings: result.warnings };
}
