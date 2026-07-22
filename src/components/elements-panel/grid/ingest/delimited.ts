import { parseDelimitedMatrix } from "./matrix";
import type { IngestResult } from "./types";

/** Parse CSV text with comma delimiter. */
export function parseCsv(text: string): IngestResult {
	const matrix = parseDelimitedMatrix(text, ",");
	return { matrix, warnings: [] };
}

/** Parse TSV text with tab delimiter. */
export function parseTsv(text: string): IngestResult {
	const matrix = parseDelimitedMatrix(text, "\t");
	return { matrix, warnings: [] };
}

/** Detect whether text is more likely CSV (comma) or TSV (tab).
 *
 * Heuristic: count occurrences of comma vs tab in first 10 lines.
 * Handle locale differences (some regions use ; as CSV delimiter).
 */
export function detectDelimiter(text: string): string {
	const lines = text.split("\n").slice(0, 10);
	let commaCount = 0;
	let tabCount = 0;
	let semicolonCount = 0;

	for (const line of lines) {
		for (const char of line) {
			if (char === ",") commaCount++;
			else if (char === "\t") tabCount++;
			else if (char === ";") semicolonCount++;
		}
	}

	// Tab is strongest signal (spreadsheets typically export TSV with tabs)
	if (tabCount > 0) return "\t";
	// Otherwise check between comma and semicolon
	if (semicolonCount > commaCount) return ";";
	return ",";
}

/** Parse delimited text, auto-detecting delimiter. */
export function parseDelimited(text: string): IngestResult {
	const delimiter = detectDelimiter(text);
	const matrix = parseDelimitedMatrix(text, delimiter);
	return { matrix, warnings: [] };
}
