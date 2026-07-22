import type { CellAddr } from "./grid-model";
import type { IngestWarning } from "./ingest/types";

export interface ApplyMatrixResult {
	rows: string[][];
	warnings: IngestWarning[];
}

/** Apply an imported matrix starting at anchor cell.
 *
 * - Fills EXISTING columns only (extra columns in matrix -> warning, truncated)
 * - Grows/pads rows as needed
 * - All rows padded to headers.length
 * - Used identically by paste AND file import
 */
export function applyMatrix(
	headers: string[],
	rows: string[][],
	matrix: string[][],
	anchor: CellAddr
): ApplyMatrixResult {
	const warnings: IngestWarning[] = [];
	const width = headers.length;
	const newRows = rows.map((r) => [...r]); // Copy existing

	if (matrix.length === 0) {
		return { rows: newRows, warnings };
	}

	// Grow rows to fit matrix
	const maxRow = anchor.r + matrix.length - 1;
	while (newRows.length <= maxRow) {
		newRows.push(Array(width).fill(""));
	}

	// Fill matrix cells starting at anchor
	for (let mi = 0; mi < matrix.length; mi++) {
		const matrixRow = matrix[mi];
		const gridRow = anchor.r + mi;

		// Check for columns beyond grid width
		if (matrixRow.length > width) {
			warnings.push({
				type: "truncated_columns",
				message: `Row ${gridRow + 1} has ${matrixRow.length} columns but grid has only ${width}. Extra columns truncated.`
			});
		}

		// Fill up to grid width, truncating extras
		for (let mc = 0; mc < Math.min(matrixRow.length, width); mc++) {
			const gridCol = anchor.c + mc;
			if (gridCol < width) {
				newRows[gridRow][gridCol] = matrixRow[mc];
			}
		}

		// Pad row to width
		while (newRows[gridRow].length < width) {
			newRows[gridRow].push("");
		}
	}

	return { rows: newRows, warnings };
}
