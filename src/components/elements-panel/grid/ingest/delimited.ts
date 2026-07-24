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

/** Detect a delimiter outside quoted fields in the first ten logical records. */
export function detectDelimiter(text: string): string {
	const candidates = [",", "\t", ";"];
	const counts = new Map(candidates.map((candidate) => [candidate, 0]));
	let inQuotes = false;
	let fieldStart = true;
	let records = 0;
	for (let index = 0; index < text.length && records < 10; index++) {
		const char = text[index] ?? "";
		if (inQuotes) {
			if (char === '"') {
				if (text[index + 1] === '"') index++;
				else inQuotes = false;
			}
			continue;
		}
		if (char === '"' && fieldStart) {
			inQuotes = true;
			continue;
		}
		if (char === "\r" || char === "\n") {
			if (char === "\r" && text[index + 1] === "\n") index++;
			records++;
			fieldStart = true;
			continue;
		}
		if (counts.has(char)) {
			counts.set(char, (counts.get(char) ?? 0) + 1);
			fieldStart = true;
		} else {
			fieldStart = false;
		}
	}
	return candidates.reduce((best, candidate) =>
		(counts.get(candidate) ?? 0) > (counts.get(best) ?? 0) ? candidate : best
	);
}

/** Parse delimited text, auto-detecting delimiter. */
export function parseDelimited(text: string): IngestResult {
	const delimiter = detectDelimiter(text);
	const matrix = parseDelimitedMatrix(text, delimiter);
	return { matrix, warnings: [] };
}
