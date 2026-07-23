import { growToFit, normalizeHeaders, normalizeNameRows, validateNameRows, type CellAddr } from "./grid-model";
import type { IngestWarning } from "./ingest/types";

export interface ApplyMatrixResult {
	headers: string[];
	rows: string[][];
	warnings: IngestWarning[];
}

/** Apply an imported matrix starting at anchor cell.
 *
 * Grows, applies, validates, normalizes, and returns the full replacement grid.
 * It never discards supplied matrix cells.
 */
export function applyMatrix(
	headers: string[],
	rows: string[][],
	matrix: string[][],
	anchor: CellAddr
): ApplyMatrixResult {
	if (matrix.length === 0) {
		const normalizedHeaders = normalizeHeaders(headers);
		return { headers: normalizedHeaders, rows: normalizeNameRows(rows, normalizedHeaders.length), warnings: [] };
	}
	let matrixWidth = 0;
	for (const matrixRow of matrix) matrixWidth = Math.max(matrixWidth, matrixRow.length);
	const grown = growToFit(headers, rows, { r: anchor.r + matrix.length - 1, c: anchor.c + matrixWidth - 1 });
	const nextRows = grown.rows.map((row) => [...row]);
	for (const [rowOffset, matrixRow] of matrix.entries()) {
		for (const [columnOffset, value] of matrixRow.entries()) {
			nextRows[anchor.r + rowOffset]![anchor.c + columnOffset] = value;
		}
	}
	validateNameRows(nextRows);
	return { headers: grown.headers, rows: normalizeNameRows(nextRows, grown.headers.length), warnings: [] };
}
