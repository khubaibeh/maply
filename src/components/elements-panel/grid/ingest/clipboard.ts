import { parseTsv } from "./delimited";
import type { IngestResult } from "./types";

/** Parse clipboard text as tab-separated values (spreadsheets copy as TSV).
 *
 * Do NOT trim cells — preserve whitespace as user intended.
 */
export function parseClipboard(text: string): IngestResult {
	return parseTsv(text);
}

/** Serialize a grid range to tab-separated, newline-delimited format suitable for clipboard.
 *
 * Round-trip: serialize -> clipboard -> paste -> parse should preserve content.
 */
export function serializeGridRange(rows: string[][], columns: { from: number; to: number }): string {
	const lines: string[] = [];
	for (const row of rows) {
		const cells = [];
		for (let c = columns.from; c <= columns.to && c < row.length; c++) {
			const cell = row[c] ?? "";
			// Escape cells containing tab, newline, or quote for safe clipboard round-trip
			if (cell.includes("\t") || cell.includes("\n") || cell.includes('"')) {
				cells.push(`"${cell.replaceAll('"', '""')}"`);
			} else {
				cells.push(cell);
			}
		}
		lines.push(cells.join("\t"));
	}
	// Add trailing newline for good practice
	return lines.join("\n") + "\n";
}
