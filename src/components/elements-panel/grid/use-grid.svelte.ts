import { SvelteSet } from "svelte/reactivity";

import { applyMatrix } from "./grid-apply";
import { addColumn, deleteColumns, deleteRows, growToFit, insertRows, setCell } from "./grid-model";
import type { CellAddr } from "./grid-model";
import { navigate } from "./grid-navigation";
import type { CellStatus, Range } from "./grid-selection";
import { cellStatus, normalizeRange, updateHeaderSelection } from "./grid-selection";
import { parseClipboard } from "./ingest/clipboard";
import { serializeGridRange } from "./ingest/clipboard";
import { parseFile } from "./ingest/file";

export interface HeaderSelection {
	kind: "row" | "col";
	indices: Set<number>;
}

type GridKeyEvent = Pick<KeyboardEvent, "key" | "shiftKey" | "ctrlKey" | "metaKey" | "target" | "preventDefault">;

/** The grid hook. Owns all `$state` and provides intent methods for the UI. */
export function createGrid(initialRows = 10) {
	// Core state
	let headers = $state<string[]>(["Name"]);
	let rows = $state<string[][]>(
		Array(initialRows)
			.fill(null)
			.map(() => [""])
	);
	let active = $state<CellAddr>({ r: 0, c: 0 });
	let editing = $state<CellAddr | null>(null);
	let selection = $state<Range | null>(null);
	let headerSel = $state<HeaderSelection | null>(null);
	let rowSelectionAnchor: number | null = null;
	let columnSelectionAnchor: number | null = null;

	// Derived
	const dims = $derived({ rows: rows.length, cols: headers.length });
	// Selecting every row means the whole table is selected, so columns read as selected too.
	const allRowsSelected = $derived(headerSel?.kind === "row" && headerSel.indices.size === rows.length);
	function selectedCellStatus(addr: CellAddr): CellStatus {
		// Header (row/column) selection is its own exclusive mode: while it's active
		// the cell cursor (active/editing) is hidden so only one selection is ever shown.
		if (headerSel) {
			if (headerSel.kind === "row" && headerSel.indices.has(addr.r)) return "selected";
			if (headerSel.kind === "col" && headerSel.indices.has(addr.c)) return "selected";
			return "normal";
		}
		return cellStatus(addr, active, selection, editing);
	}

	// Intent methods
	function setHeader(colIndex: number, value: string) {
		headers[colIndex] = value;
	}

	function setEditing(addr: CellAddr | null) {
		if (addr && addr.r < rows.length && addr.c < headers.length) {
			editing = addr;
			selection = null; // Editing and selection are mutually exclusive
		} else {
			editing = null;
		}
	}

	function commitEdit(value: string) {
		if (!editing) return;
		rows = setCell(rows, editing, value);
		editing = null;
	}

	function cancelEdit() {
		editing = null;
	}

	function moveTo(addr: CellAddr, clearSelection = true) {
		if (addr.r >= 0 && addr.r < dims.rows && addr.c >= 0 && addr.c < dims.cols) {
			active = addr;
			if (clearSelection) selection = null;
			// Focusing a cell clears any row/column header selection
			headerSel = null;
		}
	}

	function startCellSelection(addr: CellAddr, extend: boolean) {
		if (addr.r < 0 || addr.r >= dims.rows || addr.c < 0 || addr.c >= dims.cols) return;
		headerSel = null;
		editing = null;
		if (extend) {
			selection = { anchor: selection?.anchor ?? active, focus: addr };
			return;
		}
		active = addr;
		selection = null;
	}

	function extendCellSelection(addr: CellAddr) {
		if (addr.r < 0 || addr.r >= dims.rows || addr.c < 0 || addr.c >= dims.cols) return;
		headerSel = null;
		selection = { anchor: selection?.anchor ?? active, focus: addr };
	}

	function handleKeydown(event: GridKeyEvent) {
		if (!editing) {
			// Navigation mode
			const { next } = navigate(active, event.key, dims, event.shiftKey);

			if (event.key.startsWith("Arrow")) {
				event.preventDefault();
				if (event.key === "ArrowDown" && !event.shiftKey && active.r === dims.rows - 1) {
					rows.push(Array(headers.length).fill(""));
					moveTo({ r: rows.length - 1, c: active.c });
				} else if (event.shiftKey) {
					// Extend selection
					if (!selection) {
						selection = { anchor: active, focus: active };
					}
					selection.focus = next;
				} else {
					moveTo(next);
				}
			} else if (event.key === "Tab") {
				event.preventDefault();
				const { next: navNext, needsNewRow: navNeedsNewRow } = navigate(active, "Tab", dims, event.shiftKey);
				if (navNeedsNewRow) {
					// Create new row
					rows.push(Array(headers.length).fill(""));
					moveTo({ r: rows.length - 1, c: 0 });
				} else {
					moveTo(navNext);
				}
			} else if (event.key === "Enter") {
				event.preventDefault();
				setEditing(active);
			} else if (
				/^[\w\s!@#$%^&*()\-=_+[\]{};':"\\|,.<>?/]$/.test(event.key) &&
				!event.ctrlKey &&
				!event.metaKey
			) {
				// Printable char: start editing and replace content
				event.preventDefault();
				rows = setCell(rows, active, event.key);
				setEditing(active);
			} else if (event.key === "Delete" || event.key === "Backspace") {
				event.preventDefault();
				rows = setCell(rows, active, "");
			} else if (event.key === "Escape") {
				// Cancel any multi-selection
				selection = null;
				headerSel = null;
			}
		} else if (editing) {
			// Editing mode
			if (event.key === "Enter") {
				event.preventDefault();
				commitEdit((event.target as HTMLInputElement).value || "");
			} else if (event.key === "Tab") {
				event.preventDefault();
				commitEdit((event.target as HTMLInputElement).value || "");
				const { next, needsNewRow } = navigate(active, "Tab", dims, false);
				if (needsNewRow) {
					rows.push(Array(headers.length).fill(""));
					moveTo({ r: rows.length - 1, c: 0 });
				} else {
					moveTo(next);
				}
			} else if (event.key === "Escape") {
				event.preventDefault();
				cancelEdit();
			}
		}
	}

	async function handlePaste(text: string) {
		const result = parseClipboard(text);
		const applied = applyMatrix(headers, rows, result.matrix, active);
		rows = applied.rows;
		// On paste, grow to fit if needed
		const maxR = active.r + result.matrix.length - 1;
		const maxC = active.c + (result.matrix[0]?.length ?? 0) - 1;
		const grown = growToFit(headers, rows, { r: maxR, c: maxC });
		headers = grown.headers;
		rows = grown.rows;
	}

	async function handleImportFile(file: File) {
		const result = await parseFile(file);
		const applied = applyMatrix(headers, rows, result.matrix, active);
		rows = applied.rows;
		// Grow to fit the imported data
		const maxR = active.r + result.matrix.length - 1;
		const maxC = active.c + (result.matrix[0]?.length ?? 0) - 1;
		const grown = growToFit(headers, rows, { r: maxR, c: maxC });
		headers = grown.headers;
		rows = grown.rows;
		return result;
	}

	function addNewColumn() {
		const result = addColumn(headers, rows);
		headers = result.headers;
		rows = result.rows;
	}

	function addNewRow() {
		rows = [...rows, Array(headers.length).fill("")];
	}

	/** Row indices affected by a row action: the whole row selection if `index` is part
	 *  of it, otherwise just the clicked row. */
	function targetRows(index: number): number[] {
		if (headerSel?.kind === "row" && headerSel.indices.has(index)) {
			return Array.from(headerSel.indices).sort((a, b) => a - b);
		}
		return [index];
	}

	function selectAllRows() {
		headerSel = { kind: "row", indices: new SvelteSet(rows.map((_, i) => i)) };
		selection = null;
	}

	function clearHeaderSelection() {
		headerSel = null;
	}

	function deleteRowAt(index: number) {
		const targets = targetRows(index).sort((a, b) => b - a);
		for (const i of targets) {
			const result = deleteRows(headers, rows, i, 1);
			headers = result.headers;
			rows = result.rows;
		}
		headerSel = null;
		if (active.r >= rows.length) active = { r: Math.max(0, rows.length - 1), c: active.c };
	}

	/** Move the clicked (or selected) rows up by one, keeping selection with them. */
	function moveRowUp(index: number) {
		const targets = targetRows(index);
		if (targets[0] <= 0) return;
		const next = [...rows];
		for (const i of targets) [next[i - 1], next[i]] = [next[i], next[i - 1]];
		rows = next;
		if (headerSel?.kind === "row") {
			headerSel = { kind: "row", indices: new SvelteSet(targets.map((i) => i - 1)) };
		}
	}

	/** Move the clicked (or selected) rows down by one, keeping selection with them. */
	function moveRowDown(index: number) {
		const targets = targetRows(index);
		if (targets[targets.length - 1] >= rows.length - 1) return;
		const next = [...rows];
		for (let k = targets.length - 1; k >= 0; k--) {
			const i = targets[k];
			[next[i + 1], next[i]] = [next[i], next[i + 1]];
		}
		rows = next;
		if (headerSel?.kind === "row") {
			headerSel = { kind: "row", indices: new SvelteSet(targets.map((i) => i + 1)) };
		}
	}

	/** Insert an empty row directly above `index`. */
	function insertRowAbove(index: number) {
		const result = insertRows(headers, rows, index, 1);
		headers = result.headers;
		rows = result.rows;
	}

	/** Copy the clicked (or selected) rows to the clipboard as tab-separated text. */
	async function copyRows(index: number) {
		const targets = targetRows(index);
		const text = targets.map((i) => rows[i].join("\t")).join("\n") + "\n";
		await navigator.clipboard.writeText(text);
	}

	/** Paste clipboard rows in above `index` (so it also works for the first row). */
	async function pasteRowsAbove(index: number) {
		const text = await navigator.clipboard.readText();
		const { matrix } = parseClipboard(text);
		if (matrix.length === 0) return;
		const inserted = insertRows(headers, rows, index, matrix.length);
		const applied = applyMatrix(inserted.headers, inserted.rows, matrix, { r: index, c: 0 });
		headers = inserted.headers;
		rows = applied.rows;
	}

	function selectColumn(colIndex: number, shift: boolean, ctrl: boolean) {
		const indices = updateHeaderSelection(
			headerSel?.kind === "col" ? headerSel.indices : null,
			colIndex,
			shift,
			ctrl
		);
		headerSel = indices ? { kind: "col", indices } : null;
		selection = null;
	}

	function startColumnSelection(colIndex: number, extend: boolean, toggle: boolean) {
		if (colIndex < 0 || colIndex >= dims.cols) return;
		editing = null;
		selection = null;
		if (extend && headerSel?.kind === "col" && headerSel.indices.size > 0) {
			columnSelectionAnchor = Math.min(...headerSel.indices);
			selectColumn(colIndex, true, false);
			return;
		}
		columnSelectionAnchor = colIndex;
		if (toggle) {
			selectColumn(colIndex, false, true);
			return;
		}
		headerSel = { kind: "col", indices: new SvelteSet([colIndex]) };
	}

	function extendColumnSelection(colIndex: number) {
		if (columnSelectionAnchor === null || colIndex < 0 || colIndex >= dims.cols) return;
		const from = Math.min(columnSelectionAnchor, colIndex);
		const to = Math.max(columnSelectionAnchor, colIndex);
		headerSel = {
			kind: "col",
			indices: new SvelteSet(Array.from({ length: to - from + 1 }, (_, i) => from + i))
		};
		selection = null;
	}

	function selectRow(rowIndex: number, shift: boolean, ctrl: boolean) {
		const indices = updateHeaderSelection(
			headerSel?.kind === "row" ? headerSel.indices : null,
			rowIndex,
			shift,
			ctrl
		);
		headerSel = indices ? { kind: "row", indices } : null;
		selection = null;
	}

	function startRowSelection(rowIndex: number, extend: boolean, toggle: boolean) {
		if (rowIndex < 0 || rowIndex >= dims.rows) return;
		editing = null;
		selection = null;
		if (extend && headerSel?.kind === "row" && headerSel.indices.size > 0) {
			rowSelectionAnchor = Math.min(...headerSel.indices);
			selectRow(rowIndex, true, false);
			return;
		}
		rowSelectionAnchor = rowIndex;
		if (toggle) {
			selectRow(rowIndex, false, true);
			return;
		}
		headerSel = { kind: "row", indices: new SvelteSet([rowIndex]) };
	}

	function extendRowSelection(rowIndex: number) {
		if (rowSelectionAnchor === null || rowIndex < 0 || rowIndex >= dims.rows) return;
		const from = Math.min(rowSelectionAnchor, rowIndex);
		const to = Math.max(rowSelectionAnchor, rowIndex);
		headerSel = {
			kind: "row",
			indices: new SvelteSet(Array.from({ length: to - from + 1 }, (_, i) => from + i))
		};
		selection = null;
	}

	function deleteSelected() {
		if (!headerSel) return;
		if (headerSel.kind === "row") {
			const indices = Array.from(headerSel.indices).sort((a, b) => b - a);
			for (const i of indices) {
				const result = deleteRows(headers, rows, i, 1);
				headers = result.headers;
				rows = result.rows;
			}
			headerSel = null;
			// Move active to a valid cell
			if (active.r >= rows.length) {
				active.r = Math.max(0, rows.length - 1);
			}
		} else if (headerSel.kind === "col") {
			const result = deleteColumns(headers, rows, headerSel.indices);
			headers = result.headers;
			rows = result.rows;
			headerSel = null;
			// Move active to a valid cell
			if (active.c >= headers.length) {
				active.c = Math.max(0, headers.length - 1);
			}
		}
	}

	function copySelection(): string {
		if (!selection) {
			// Copy single active cell
			const value = rows[active.r]?.[active.c] ?? "";
			return value + "\n";
		}
		const norm = normalizeRange(selection);
		return serializeGridRange(
			rows.slice(norm.minRow, norm.maxRow + 1).map((row) => row.slice(norm.minCol, norm.maxCol + 1)),
			{ from: 0, to: norm.maxCol - norm.minCol }
		);
	}

	return {
		// State (for bindings/derived)
		get headers() {
			return headers;
		},
		set headers(value: string[]) {
			headers = value;
		},
		get rows() {
			return rows;
		},
		set rows(value: string[][]) {
			rows = value;
		},
		get active() {
			return active;
		},
		get editing() {
			return editing;
		},
		get selection() {
			return selection;
		},
		get headerSel() {
			return headerSel;
		},
		get dims() {
			return dims;
		},

		// Methods
		setHeader,
		setEditing,
		commitEdit,
		cancelEdit,
		moveTo,
		startCellSelection,
		extendCellSelection,
		selectedCellStatus,
		handleKeydown,
		handlePaste,
		handleImportFile,
		addNewColumn,
		addNewRow,
		selectAllRows,
		clearHeaderSelection,
		get allRowsSelected() {
			return allRowsSelected;
		},
		deleteRowAt,
		moveRowUp,
		moveRowDown,
		insertRowAbove,
		copyRows,
		pasteRowsAbove,
		selectColumn,
		startColumnSelection,
		extendColumnSelection,
		selectRow,
		startRowSelection,
		extendRowSelection,
		deleteSelected,
		copySelection
	};
}

export type Grid = ReturnType<typeof createGrid>;
