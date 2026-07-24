/** Maximum accepted untrusted import file size. */
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export {
	MAX_ELEMENT_NAME_GRID_CELLS as MAX_CELLS,
	MAX_ELEMENT_NAME_GRID_COLUMNS as MAX_COLUMNS,
	MAX_ELEMENT_NAME_GRID_ROWS as MAX_ROWS
} from "@maply/model";

/** Warning about data loss or format issues during ingestion. */
export interface IngestWarning {
	type: "truncated_columns" | "encoding";
	message: string;
}

export type ImportErrorCode =
	"file_too_large" | "too_many_rows" | "too_many_columns" | "too_many_cells" | "invalid_file";

/** A safe, user-facing failure while reading untrusted import data. */
export class ImportError extends Error {
	readonly _tag = "ImportError";

	constructor(
		readonly code: ImportErrorCode,
		message: string
	) {
		super(message);
		this.name = "ImportError";
	}
}

/** Result of ingesting data from any source. */
export interface IngestResult {
	matrix: string[][];
	warnings: IngestWarning[];
}
