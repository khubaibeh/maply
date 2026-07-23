import { parseCsv, parseDelimited, parseTsv } from "./delimited";
import { parseExcel } from "./excel";
import { ImportError, MAX_FILE_BYTES, type IngestResult } from "./types";

/** Route a File to the appropriate ingest handler based on extension/MIME type. */
export async function parseFile(file: File): Promise<IngestResult> {
	if (file.size > MAX_FILE_BYTES) {
		throw new ImportError(
			"file_too_large",
			`Files may be at most ${(MAX_FILE_BYTES / 1024 / 1024).toLocaleString()} MB.`
		);
	}
	const name = file.name.toLowerCase();
	const mime = file.type.toLowerCase();

	// Excel formats
	if (name.endsWith(".xlsx") || name.endsWith(".xls") || mime.includes("spreadsheetml") || mime.includes("excel")) {
		const buffer = await file.arrayBuffer();
		return parseExcel(buffer);
	}

	// Known extensions do not need delimiter detection.
	const text = await file.text();
	if (name.endsWith(".csv")) return parseCsv(text);
	if (name.endsWith(".tsv")) return parseTsv(text);
	return parseDelimited(text);
}
