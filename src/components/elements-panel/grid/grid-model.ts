/** Core grid data types and mutations. Maintains rectangularity invariant. */

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

/** Add a new column at the end, padding all rows. */
export function addColumn(headers: string[], rows: string[][]): { headers: string[]; rows: string[][] } {
	const newHeaders = [...headers, ""];
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
	const newRows = [...rows];
	const emptyRow = Array(headers.length).fill("");
	newRows.splice(
		at,
		0,
		...Array(count)
			.fill(emptyRow)
			.map(() => [...emptyRow])
	);
	return { headers, rows: newRows };
}

/** Delete `count` rows starting at index `at`. */
export function deleteRows(
	headers: string[],
	rows: string[][],
	at: number,
	count: number
): { headers: string[]; rows: string[][] } {
	const newRows = [...rows];
	newRows.splice(at, count);
	// Ensure at least 1 row
	if (newRows.length === 0) {
		newRows.push(Array(headers.length).fill(""));
	}
	return { headers, rows: newRows };
}

/** Delete columns by indices (can be non-contiguous). */
export function deleteColumns(
	headers: string[],
	rows: string[][],
	indices: Set<number>
): { headers: string[]; rows: string[][] } {
	const newHeaders = headers.filter((_, i) => !indices.has(i));
	// Ensure at least 1 column
	if (newHeaders.length === 0) {
		return {
			headers: [""],
			rows: rectangularize(
				rows.map(() => [""]),
				1
			)
		};
	}
	const newRows = rows.map((row) => row.filter((_, i) => !indices.has(i)));
	return { headers: newHeaders, rows: newRows };
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
	const newHeaders = [...headers];
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
