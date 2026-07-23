/** Core grid data types and mutations. Maintains rectangularity invariant. */

export const nameColumnHeader = "Name";

export interface CellAddr {
	r: number;
	c: number;
}

/** Ensure every row has exactly `headers.length` cells, padding with "". */
function rectangularize(rows: string[][], width: number): string[][] {
	return rows.map((row) => {
		const padded = [...row];
		while (padded.length < width) padded.push("");
		return padded.slice(0, width);
	});
}

/** Rejects rows that cannot satisfy the single blank-name bucket invariant. */
export function validateNameRows(rows: readonly (readonly string[])[]): void {
	const blankRowsWithValues = rows.flatMap((row, index) => {
		const hasBlankName = !(row[0] ?? "").trim();
		const hasSecondaryValue = row.slice(1).some((value) => value !== "");
		return hasBlankName && hasSecondaryValue ? [index + 1] : [];
	});
	if (blankRowsWithValues.length > 1) {
		throw new Error(`Name is required for imported rows ${blankRowsWithValues.join(", ")}.`);
	}
}

/** Restores the immutable Name header after every model mutation. */
export function normalizeHeaders(headers: readonly string[]): string[] {
	const normalized = headers.length > 0 ? [...headers] : [nameColumnHeader];
	normalized[0] = nameColumnHeader;
	return normalized;
}

/** Keeps one trailing blank-name row as the bucket for unmatched elements. */
export function normalizeNameRows(rows: string[][], width: number): string[][] {
	const normalized = rectangularize(rows, width);
	validateNameRows(normalized);
	const namedRows = normalized.filter((row) => row[0]?.trim());
	const blankRow =
		normalized.find((row) => !row[0]?.trim() && row.slice(1).some((value) => value !== "")) ??
		Array(width).fill("");
	return [...namedRows, blankRow];
}

/** Add a new column at the end, padding all rows. */
export function addColumn(headers: string[], rows: string[][]): { headers: string[]; rows: string[][] } {
	const newHeaders = [...normalizeHeaders(headers), ""];
	const newRows = rectangularize(rows, newHeaders.length);
	return { headers: newHeaders, rows: newRows };
}

/** Insert `count` empty rows starting at index `at`. */
export function insertRows(
	headers: string[],
	rows: string[][],
	at: number,
	count: number
): { headers: string[]; rows: string[][] } {
	const normalizedHeaders = normalizeHeaders(headers);
	const newRows = [...rows];
	const emptyRow = Array(normalizedHeaders.length).fill("");
	newRows.splice(
		at,
		0,
		...Array(count)
			.fill(emptyRow)
			.map(() => [...emptyRow])
	);
	return { headers: normalizedHeaders, rows: newRows };
}

/** Delete `count` rows starting at index `at`. */
export function deleteRows(
	headers: string[],
	rows: string[][],
	at: number,
	count: number
): { headers: string[]; rows: string[][] } {
	const normalizedHeaders = normalizeHeaders(headers);
	const newRows = [...rows];
	newRows.splice(at, count);
	// Ensure at least 1 row
	if (newRows.length === 0) {
		newRows.push(Array(normalizedHeaders.length).fill(""));
	}
	return { headers: normalizedHeaders, rows: newRows };
}

/** Delete columns by indices (can be non-contiguous). */
export function deleteColumns(
	headers: string[],
	rows: string[][],
	indices: Set<number>
): { headers: string[]; rows: string[][] } {
	const retained = normalizeHeaders(headers)
		.map((_, index) => index)
		.filter((index) => index === 0 || !indices.has(index));
	const newHeaders = retained.map((index) => normalizeHeaders(headers)[index] ?? "");
	const newRows = rows.map((row) => retained.map((index) => row[index] ?? ""));
	return { headers: normalizeHeaders(newHeaders), rows: newRows };
}

/** Updates an editable header without permitting the Name header to change. */
export function setGridHeader(headers: readonly string[], column: number, value: string): string[] {
	const next = normalizeHeaders(headers);
	if (column > 0 && column < next.length) next[column] = value;
	return next;
}

/** Replace cell content immutably. */
export function setCell(rows: string[][], addr: CellAddr, value: string): string[][] {
	const newRows = rows.map((currentRow, r) =>
		r === addr.r ? currentRow.map((cell, c) => (c === addr.c ? value : cell)) : currentRow
	);
	return newRows;
}

/** Grow grid to fit a cell at `target`. Pads rows and columns as needed. */
export function growToFit(
	headers: string[],
	rows: string[][],
	target: CellAddr
): { headers: string[]; rows: string[][] } {
	const newHeaders = normalizeHeaders(headers);
	let newRows = [...rows];

	// Grow columns
	while (newHeaders.length <= target.c) {
		newHeaders.push("");
	}

	// Rectangularize existing rows
	newRows = rectangularize(newRows, newHeaders.length);

	// Grow rows
	while (newRows.length <= target.r) {
		newRows.push(Array(newHeaders.length).fill(""));
	}

	return { headers: newHeaders, rows: newRows };
}
