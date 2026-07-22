import type { IngestResult, IngestWarning } from "./types";

/** Parse Excel .xlsx file (binary ArrayBuffer) into a matrix.
 *
 * Uses SheetJS (xlsx) loaded via dynamic import to avoid adding to main bundle.
 * - Selects first non-empty sheet
 * - Uses DISPLAYED/formatted values (for numbers, dates, etc.) to preserve intent
 * - Handles merged cells gracefully (takes value from first cell)
 * - Rectangularizes result
 */
export async function parseExcel(buffer: ArrayBuffer): Promise<IngestResult> {
	const warnings: IngestWarning[] = [];

	try {
		// Lazy load xlsx to keep it out of main bundle
		const { read } = await import("xlsx");

		const workbook = read(buffer, { type: "array" });

		// Find first non-empty sheet
		let sheet = null;
		for (const name of workbook.SheetNames) {
			const s = workbook.Sheets[name];
			if (s && Object.keys(s).length > 1) {
				// More than just ref
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

		// Parse range (e.g., "A1:D10")
		const [, start, end] = ref.match(/^(.+):(.+)$/) || [];
		if (!start || !end) {
			return { matrix: [[]], warnings: [] };
		}

		const { row: startRow, col: startCol } = cellAddress(start);
		const { row: endRow, col: endCol } = cellAddress(end);

		// Build matrix row by row, column by column
		const matrix: string[][] = [];
		for (let r = startRow; r <= endRow; r++) {
			const row: string[] = [];
			for (let c = startCol; c <= endCol; c++) {
				const cellKey = cellRef(r, c);
				const cellData = sheet[cellKey];
				// Use formatted value (v for raw, f for formula, w for text); fallback to ""
				const value = cellData?.w ?? cellData?.v ?? "";
				row.push(String(value).trim());
			}
			matrix.push(row);
		}

		return { matrix, warnings };
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return { matrix: [], warnings: [{ type: "encoding", message: `Failed to parse Excel: ${msg}` }] };
	}
}

/** Convert spreadsheet cell address (e.g., "A1") to 0-based {row, col}. */
function cellAddress(addr: string): { row: number; col: number } {
	let col = 0;
	let i = 0;
	// Parse column letters (A-Z, AA-ZZ, etc.)
	while (i < addr.length && /[A-Z]/i.test(addr[i])) {
		col = col * 26 + (addr.charCodeAt(i) - (addr[i] >= "a" ? 97 : 65) + 1);
		i++;
	}
	const row = parseInt(addr.substring(i), 10) - 1;
	return { row: Math.max(0, row), col: Math.max(0, col - 1) };
}

/** Convert 0-based {row, col} to spreadsheet cell address. */
function cellRef(row: number, col: number): string {
	let colStr = "";
	let c = col + 1;
	while (c > 0) {
		colStr = String.fromCharCode(64 + ((c - 1) % 26) + 1) + colStr;
		c = Math.floor((c - 1) / 26);
	}
	return `${colStr}${row + 1}`;
}
