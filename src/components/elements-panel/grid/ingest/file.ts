import { parseDelimited } from "./delimited";
import { parseExcel } from "./excel";
import type { IngestResult } from "./types";

/** Route a File to the appropriate ingest handler based on extension/MIME type. */
export async function parseFile(file: File): Promise<IngestResult> {
	const name = file.name.toLowerCase();
	const mime = file.type.toLowerCase();

	// Excel formats
	if (name.endsWith(".xlsx") || name.endsWith(".xls") || mime.includes("spreadsheetml") || mime.includes("excel")) {
		const buffer = await file.arrayBuffer();
		return parseExcel(buffer);
	}

	// Text formats (CSV, TSV, TXT, etc.)
	const text = await file.text();
	return parseDelimited(text);
}
