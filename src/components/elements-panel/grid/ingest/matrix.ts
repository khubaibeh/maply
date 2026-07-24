import { ImportError, MAX_CELLS, MAX_COLUMNS, MAX_ROWS } from "./types";

/** Parse delimited text into a bounded rectangular matrix of cells.
 *
 * Handles:
 * - RFC 4180-style quoted fields with "" escaping
 * - Embedded delimiters and newlines within quoted fields
 * - Both \r\n and \n line endings
 * - Trailing newline stripping
 * - Rectangular enforcement via padding
 */
export function parseDelimitedMatrix(text: string, delimiter: string): string[][] {
	// Normalize line endings and strip one UTF-8 BOM.
	const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n?|\n/g, "\n");

	if (!normalized) return [[""]];

	const matrix: string[][] = [];
	let row: string[] = [];
	let cell = "";
	let inQuotes = false;
	let quotedFieldClosed = false;
	let i = 0;
	let cellCount = 0;

	function appendCell() {
		if (row.length >= MAX_COLUMNS) {
			throw new ImportError(
				"too_many_columns",
				`Imports may contain at most ${MAX_COLUMNS.toLocaleString()} columns.`
			);
		}
		row.push(cell);
		cell = "";
	}

	function appendRow() {
		if (matrix.length >= MAX_ROWS) {
			throw new ImportError("too_many_rows", `Imports may contain at most ${MAX_ROWS.toLocaleString()} rows.`);
		}
		cellCount += row.length;
		if (cellCount > MAX_CELLS) {
			throw new ImportError("too_many_cells", `Imports may contain at most ${MAX_CELLS.toLocaleString()} cells.`);
		}
		matrix.push(row);
		row = [];
	}

	while (i < normalized.length) {
		const char = normalized[i];

		if (inQuotes) {
			// Inside quotes, look for closing quote
			if (char === '"') {
				const nextChar = normalized[i + 1];
				if (nextChar === '"') {
					// "" escape sequence
					cell += '"';
					i += 2;
					continue;
				} else {
					// End of quoted field
					inQuotes = false;
					quotedFieldClosed = true;
					i++;
					continue;
				}
			} else if (char === "\n") {
				// Newline inside quoted field
				cell += "\n";
				i++;
				continue;
			} else {
				cell += char;
				i++;
				continue;
			}
		} else {
			// Not in quotes
			if (quotedFieldClosed && char !== delimiter && char !== "\n") {
				throw new ImportError("invalid_file", "Quoted fields must end before the next delimiter or row.");
			} else if (char === '"') {
				if (cell.length > 0)
					throw new ImportError("invalid_file", "Quotes may only begin at the start of a field.");
				// Start of quoted field
				inQuotes = true;
				i++;
				continue;
			} else if (char === delimiter) {
				// Field separator
				appendCell();
				quotedFieldClosed = false;
				i++;
				continue;
			} else if (char === "\n") {
				// Row separator
				appendCell();
				appendRow();
				quotedFieldClosed = false;
				i++;
				continue;
			} else {
				cell += char;
				i++;
				continue;
			}
		}
	}

	if (inQuotes) throw new ImportError("invalid_file", "The import contains an unterminated quoted field.");

	// Add final cell and row unless the input ended with a row ending.
	if (!normalized.endsWith("\n")) {
		appendCell();
		appendRow();
	}

	// Rectangularize: pad all rows to max length
	if (matrix.length === 0) return [];
	let maxCols = 0;
	for (const parsedRow of matrix) maxCols = Math.max(maxCols, parsedRow.length);
	if (matrix.length * maxCols > MAX_CELLS) {
		throw new ImportError("too_many_cells", `Imports may contain at most ${MAX_CELLS.toLocaleString()} cells.`);
	}
	for (const r of matrix) {
		while (r.length < maxCols) r.push("");
	}

	return matrix;
}

/** Escape a cell value for output in delimited format (RFC 4180). */
export function escapeDelimitedCell(value: string, delimiter: string): string {
	// Quote if contains delimiter, quote, or newline
	if (value.includes(delimiter) || value.includes('"') || value.includes("\n")) {
		return `"${value.replaceAll('"', '""')}"`;
	}
	return value;
}
