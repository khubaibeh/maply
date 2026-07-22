/** Parse delimited text into a rectangular matrix of cells.
 *
 * Handles:
 * - RFC 4180-style quoted fields with "" escaping
 * - Embedded delimiters and newlines within quoted fields
 * - Both \r\n and \n line endings
 * - Trailing newline stripping
 * - Rectangular enforcement via padding
 */
export function parseDelimitedMatrix(text: string, delimiter: string): string[][] {
	// Normalize line endings and strip trailing newline
	const normalized = text.replace(/\r\n/g, "\n").replace(/\n$/, "");

	if (!normalized) return [];

	const matrix: string[][] = [];
	let row: string[] = [];
	let cell = "";
	let inQuotes = false;
	let i = 0;

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
			if (char === '"') {
				// Start of quoted field
				inQuotes = true;
				i++;
				continue;
			} else if (char === delimiter) {
				// Field separator
				row.push(cell);
				cell = "";
				i++;
				continue;
			} else if (char === "\n") {
				// Row separator
				row.push(cell);
				if (row.length > 0) {
					matrix.push(row);
				}
				row = [];
				cell = "";
				i++;
				continue;
			} else {
				cell += char;
				i++;
				continue;
			}
		}
	}

	// Add final cell and row
	row.push(cell);
	if (row.length > 0) {
		matrix.push(row);
	}

	// Rectangularize: pad all rows to max length
	if (matrix.length === 0) return [];
	const maxCols = Math.max(...matrix.map((r) => r.length));
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
