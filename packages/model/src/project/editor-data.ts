import { Schema } from "effect";

export const MAX_ELEMENT_NAME_GRID_ROWS = 5_000;
export const MAX_ELEMENT_NAME_GRID_COLUMNS = 50;
export const MAX_ELEMENT_NAME_GRID_CELLS = 100_000;
export const ELEMENT_NAME_HEADER = "Name";

export const ElementNameGridSchema = Schema.Struct({
	headers: Schema.Array(Schema.String),
	rows: Schema.Array(Schema.Array(Schema.String))
});

export const ProjectEditorDataSchema = Schema.Struct({
	elementNameGrid: ElementNameGridSchema
});

export type ElementNameGrid = typeof ElementNameGridSchema.Type;
export type ProjectEditorData = typeof ProjectEditorDataSchema.Type;

/** Creates the canonical empty element-name grid. */
export function createElementNameGrid(): ElementNameGrid {
	return { headers: [ELEMENT_NAME_HEADER], rows: [[""]] };
}

/** Creates editor-only data for a new, reset, or externally imported project. */
export function createProjectEditorData(): ProjectEditorData {
	return { elementNameGrid: createElementNameGrid() };
}

/** Copies an element-name grid before it crosses a state or persistence seam. */
export function copyElementNameGrid(grid: ElementNameGrid): ElementNameGrid {
	return {
		headers: [...grid.headers],
		rows: grid.rows.map((row) => [...row])
	};
}

/** Copies editor data before it crosses a state or persistence seam. */
export function copyProjectEditorData(data: ProjectEditorData): ProjectEditorData {
	return {
		elementNameGrid: copyElementNameGrid(data.elementNameGrid)
	};
}

/** Returns why an element-name grid cannot be persisted, or null when it is canonical. */
export function getElementNameGridIssue({ headers, rows }: ElementNameGrid): string | null {
	if (headers.length === 0) return "Element-name grid must have at least one column.";
	if (headers.length > MAX_ELEMENT_NAME_GRID_COLUMNS)
		return `Element-name grid may have at most ${MAX_ELEMENT_NAME_GRID_COLUMNS} columns.`;
	if (headers[0] !== ELEMENT_NAME_HEADER)
		return `Element-name grid must start with the ${ELEMENT_NAME_HEADER} column.`;
	if (rows.length === 0) return "Element-name grid must have at least one row.";
	if (rows.length > MAX_ELEMENT_NAME_GRID_ROWS)
		return `Element-name grid may have at most ${MAX_ELEMENT_NAME_GRID_ROWS} rows.`;
	if (rows.length * headers.length > MAX_ELEMENT_NAME_GRID_CELLS)
		return `Element-name grid may have at most ${MAX_ELEMENT_NAME_GRID_CELLS} cells.`;
	if (rows.some((row) => row.length !== headers.length)) return "Element-name grid rows must match its column count.";

	const blankRows = rows.flatMap((row, index) => (!(row[0] ?? "").trim() ? [index] : []));
	if (blankRows.length !== 1 || blankRows[0] !== rows.length - 1)
		return "Element-name grid must end with one blank-name row.";
	return null;
}

/** Returns why editor data cannot be persisted, or null when it is canonical. */
export function getProjectEditorDataIssue(data: ProjectEditorData): string | null {
	return getElementNameGridIssue(data.elementNameGrid);
}
