/** Source of the imported data. */
export enum IngestSource {
	Clipboard = "clipboard",
	File = "file",
	Paste = "paste"
}

/** Warning about data loss or format issues during ingestion. */
export interface IngestWarning {
	type: "truncated_columns" | "encoding";
	message: string;
}

/** Result of ingesting data from any source. */
export interface IngestResult {
	matrix: string[][];
	warnings: IngestWarning[];
}
