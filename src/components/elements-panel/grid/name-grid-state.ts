/** The editable grid data retained for each open project during this browser session. */
export interface NameGridData {
	headers: string[];
	rows: string[][];
}

const grids = new Map<string, NameGridData>();

function copyGrid(data: NameGridData): NameGridData {
	return {
		headers: [...data.headers],
		rows: data.rows.map((row) => [...row])
	};
}

/** Returns the current session's grid data for a project. */
export function loadNameGrid(projectId: string): NameGridData | undefined {
	const data = grids.get(projectId);
	return data && copyGrid(data);
}

/** Replaces the current session's grid data for a project. */
export function saveNameGrid(projectId: string, data: NameGridData): void {
	grids.set(projectId, copyGrid(data));
}
