import { ImportError, MAX_CELLS, MAX_COLUMNS, MAX_ROWS, type IngestResult, type IngestWarning } from "./types";

/** Parse Excel .xlsx file (binary ArrayBuffer) into a matrix.
 *
 * Uses SheetJS 0.20.3 from its official CDN: npm remains frozen on the vulnerable
 * 0.18.5 release. Dynamic import keeps the parser out of the initial bundle.
 * - Selects first non-empty sheet
 * - Uses DISPLAYED/formatted values (for numbers, dates, etc.) to preserve intent
 * - Handles merged cells gracefully (takes value from first cell)
 * - Rectangularizes result
 */
export async function parseExcel(buffer: ArrayBuffer): Promise<IngestResult> {
	const warnings: IngestWarning[] = [];

	try {
		// Lazy load xlsx to keep it out of main bundle
		const { read, utils } = await import("xlsx");

		const workbook = read(buffer, { type: "array" });

		// Find the first sheet containing a real cell, not just metadata.
		let sheet = null;
		for (const name of workbook.SheetNames) {
			const s = workbook.Sheets[name];
			if (s && Object.keys(s).some((key) => !key.startsWith("!") && s[key]?.v !== undefined)) {
				sheet = s;
				break;
			}
		}

		if (!sheet) {
			return { matrix: [], warnings: [{ type: "encoding", message: "No data found in Excel file" }] };
		}

		// Get dimensions
		const ref = sheet["!ref"];
		if (!ref) {
			return { matrix: [], warnings: [{ type: "encoding", message: "Could not determine sheet dimensions" }] };
		}

		let range: { s: { r: number; c: number }; e: { r: number; c: number } };
		try {
			range = utils.decode_range(ref);
		} catch {
			throw new ImportError("invalid_file", "The workbook has an invalid worksheet range.");
		}
		const rowCount = range.e.r - range.s.r + 1;
		const columnCount = range.e.c - range.s.c + 1;
		if (rowCount > MAX_ROWS)
			throw new ImportError("too_many_rows", `Imports may contain at most ${MAX_ROWS.toLocaleString()} rows.`);
		if (columnCount > MAX_COLUMNS)
			throw new ImportError(
				"too_many_columns",
				`Imports may contain at most ${MAX_COLUMNS.toLocaleString()} columns.`
			);
		if (rowCount * columnCount > MAX_CELLS)
			throw new ImportError("too_many_cells", `Imports may contain at most ${MAX_CELLS.toLocaleString()} cells.`);

		// Build matrix row by row, column by column
		const matrix: string[][] = [];
		for (let r = range.s.r; r <= range.e.r; r++) {
			const row: string[] = [];
			for (let c = range.s.c; c <= range.e.c; c++) {
				const cellKey = utils.encode_cell({ r, c });
				const cellData = sheet[cellKey];
				// Use formatted values while preserving intentional whitespace in text cells.
				const value = cellData?.w ?? cellData?.v ?? "";
				row.push(String(value));
			}
			matrix.push(row);
		}

		return { matrix, warnings };
	} catch (error) {
		if (error instanceof ImportError) throw error;
		return { matrix: [], warnings: [{ type: "encoding", message: "Could not read the workbook." }] };
	}
}
