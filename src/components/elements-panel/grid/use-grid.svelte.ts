import { SvelteMap, SvelteSet } from "svelte/reactivity";

import { applyMatrix } from "./grid-apply";
import type { GridColumn } from "./grid-filter";
import { applyImportMatrix } from "./grid-import";
import {
	addColumn,
	deleteColumns,
	deleteRows,
	insertRows,
	normalizeHeaders,
	normalizeNameRows,
	setCell,
	setGridHeader
} from "./grid-model";
import type { CellAddr } from "./grid-model";
import { navigate } from "./grid-navigation";
import type { CellStatus, Range } from "./grid-selection";
import { normalizeRange, updateHeaderSelection } from "./grid-selection";
import type { GridSort } from "./grid-sort";
import { parseClipboard } from "./ingest/clipboard";
import { serializeGridRange } from "./ingest/clipboard";
import { parseFile } from "./ingest/file";
import type { NameGridData } from "./name-grid-state";

export interface HeaderSelection {
	kind: "row" | "col";
	indices: Set<number>;
}

type GridKeyEvent = Pick<
	KeyboardEvent,
	"key" | "shiftKey" | "ctrlKey" | "metaKey" | "target" | "preventDefault" | "stopPropagation"
>;

/** The grid hook. Owns all `$state` and provides intent methods for the UI. */
export function createGrid(options: { data?: NameGridData; onChange?: (data: NameGridData) => void } = {}) {
	const initialHeaders = normalizeHeaders(options.data?.headers ?? ["Name"]);
	const initialRows = normalizeNameRows(options.data?.rows ?? [[""]], initialHeaders.length);

	// Core state
	let headers = $state<string[]>(initialHeaders);
	let rows = $state<string[][]>(initialRows);
	let active = $state<CellAddr>({ r: 0, c: 0 });
	let editing = $state<CellAddr | null>(null);
	let editingValue = $state("");
	let focusAfterCommit = false;
	let selection = $state<Range | null>(null);
	let headerSel = $state<HeaderSelection | null>(null);
	const filters = new SvelteMap<GridColumn, SvelteSet<string>>();
	let sort = $state<GridSort | null>(null);
	let visibleRows = $state<number[] | null>(null);
	let rowSelectionAnchor: number | null = null;
	let columnSelectionAnchor: number | null = null;

	function persist() {
		options.onChange?.({ headers: [...headers], rows: rows.map((row) => [...row]) });
	}

	// Derived
	const dims = $derived({ rows: rows.length, cols: headers.length });
	// Selecting every row means the whole table is selected, so columns read as selected too.
	function currentVisibleRows() {
		return visibleRows ?? rows.map((_, index) => index);
	}

	const allRowsSelected = $derived(
		headerSel?.kind === "row" && headerSel.indices.size === currentVisibleRows().length
	);
	function nextVisibleRow(rowIndex: number, direction: -1 | 1) {
		const rowsToNavigate = currentVisibleRows();
		const currentIndex = rowsToNavigate.indexOf(rowIndex);
		if (currentIndex < 0) return rowIndex;
		return rowsToNavigate[Math.max(0, Math.min(rowsToNavigate.length - 1, currentIndex + direction))] ?? rowIndex;
	}

	function nextTabCell(reverse: boolean): CellAddr {
		if (reverse) {
			if (active.c > 0) return { r: active.r, c: active.c - 1 };
			return { r: nextVisibleRow(active.r, -1), c: dims.cols - 1 };
		}
		if (active.c < dims.cols - 1) return { r: active.r, c: active.c + 1 };
		return { r: nextVisibleRow(active.r, 1), c: 0 };
	}
	function selectedCellStatus(addr: CellAddr): CellStatus {
		// Header (row/column) selection is its own exclusive mode: while it's active
		// the cell cursor (active/editing) is hidden so only one selection is ever shown.
		if (headerSel) {
			if (headerSel.kind === "row" && headerSel.indices.has(addr.r)) return "selected";
			if (headerSel.kind === "col" && headerSel.indices.has(addr.c)) return "selected";
			return "normal";
		}
		if (editing && editing.r === addr.r && editing.c === addr.c) return "editing";
		if (active.r === addr.r && active.c === addr.c) return "active";
		if (!selection) return "normal";
		const displayedRows = currentVisibleRows();
		const anchor = displayedRows.indexOf(selection.anchor.r);
		const focus = displayedRows.indexOf(selection.focus.r);
		const row = displayedRows.indexOf(addr.r);
		const from = Math.min(anchor, focus);
		const to = Math.max(anchor, focus);
		const minColumn = Math.min(selection.anchor.c, selection.focus.c);
		const maxColumn = Math.max(selection.anchor.c, selection.focus.c);
		return anchor >= 0 && focus >= 0 && row >= from && row <= to && addr.c >= minColumn && addr.c <= maxColumn
			? "selected"
			: "normal";
	}

	// Intent methods
	function setHeader(colIndex: number, value: string) {
		headers = setGridHeader(headers, colIndex, value);
		persist();
	}

	function setEditing(addr: CellAddr | null, value?: string) {
		if (addr && addr.r < rows.length && addr.c < headers.length) {
			editing = addr;
			editingValue = value ?? rows[addr.r]?.[addr.c] ?? "";
			selection = null; // Editing and selection are mutually exclusive
		} else {
			editing = null;
			editingValue = "";
		}
	}

	function commitEdit(value: string) {
		if (!editing) return;
		const committed = editing;
		if (committed.c === 0 && !value.trim() && rows.some((row, index) => index !== committed.r && !row[0]?.trim())) {
			rows = normalizeNameRows(
				rows.filter((_, index) => index !== committed.r),
				headers.length
			);
			active = { r: Math.min(committed.r, rows.length - 1), c: committed.c };
			editing = null;
			editingValue = "";
			focusAfterCommit = true;
			persist();
			return;
		}
		rows = normalizeNameRows(setCell(rows, committed, value), headers.length);
		editing = null;
		editingValue = "";
		focusAfterCommit = true;
		persist();
	}

	function cancelEdit(requestFocus = false) {
		editing = null;
		editingValue = "";
		if (requestFocus) focusAfterCommit = true;
	}

	function moveTo(addr: CellAddr, clearSelection = true) {
		if (addr.r >= 0 && addr.r < dims.rows && addr.c >= 0 && addr.c < dims.cols) {
			active = addr;
			focusAfterCommit = true;
			if (clearSelection) selection = null;
			// Focusing a cell clears any row/column header selection
			headerSel = null;
		}
	}

	function startCellSelection(addr: CellAddr, extend: boolean) {
		if (addr.r < 0 || addr.r >= dims.rows || addr.c < 0 || addr.c >= dims.cols) return;
		headerSel = null;
		cancelEdit();
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
				const visibleNext =
					event.key === "ArrowDown"
						? { ...next, r: nextVisibleRow(active.r, 1) }
						: event.key === "ArrowUp"
							? { ...next, r: nextVisibleRow(active.r, -1) }
							: next;
				if (event.key === "ArrowDown" && !event.shiftKey && active.r === dims.rows - 1) {
					moveTo({ r: addNewRow(), c: active.c });
				} else if (event.shiftKey) {
					// Extend selection
					if (!selection) {
						selection = { anchor: active, focus: active };
					}
					selection.focus = visibleNext;
				} else {
					moveTo(visibleNext);
				}
			} else if (event.key === "Tab") {
				event.preventDefault();
				moveTo(nextTabCell(event.shiftKey));
			} else if (event.key === "Enter") {
				event.preventDefault();
				setEditing(active);
			} else if (
				/^[\w\s!@#$%^&*()\-=_+[\]{};':"\\|,.<>?/]$/.test(event.key) &&
				!event.ctrlKey &&
				!event.metaKey
			) {
				// Keep the first character as an edit draft so Escape can discard it.
				event.preventDefault();
				setEditing(active, event.key);
			} else if (event.key === "Delete" || event.key === "Backspace") {
				event.preventDefault();
				rows = normalizeNameRows(setCell(rows, active, ""), headers.length);
				persist();
			} else if (event.key === "Escape") {
				if (selection || headerSel) {
					event.preventDefault();
					event.stopPropagation();
					selection = null;
					headerSel = null;
				}
			}
		} else if (editing) {
			// Editing mode
			if (event.key === "Enter") {
				event.preventDefault();
				commitEdit((event.target as HTMLInputElement).value || "");
			} else if (event.key === "Tab") {
				event.preventDefault();
				commitEdit((event.target as HTMLInputElement).value || "");
				moveTo(nextTabCell(event.shiftKey));
			} else if (event.key === "Escape") {
				event.preventDefault();
				cancelEdit(true);
			}
		}
	}

	function handlePaste(text: string) {
		const result = parseClipboard(text);
		const applied = applyMatrix(headers, rows, result.matrix, active);
		headers = applied.headers;
		rows = applied.rows;
		persist();
	}

	async function handleImportFile(file: File, hasHeader = false) {
		const result = await parseFile(file);
		const applied = applyImportMatrix(headers, rows, result.matrix, active, hasHeader);
		headers = applied.headers;
		rows = normalizeNameRows(applied.rows, applied.headers.length);
		persist();
		return { ...result, warnings: [...result.warnings, ...applied.warnings] };
	}

	function addNewColumn() {
		const result = addColumn(headers, rows);
		headers = result.headers;
		rows = result.rows;
		persist();
	}

	function addNewRow(): number {
		const blankRow = rows.findIndex((row) => !row[0]?.trim());
		if (blankRow >= 0) return blankRow;
		rows = normalizeNameRows(rows, headers.length);
		persist();
		return rows.length - 1;
	}

	/** Row indices affected by a row action: the whole row selection if `index` is part
	 *  of it, otherwise just the clicked row. */
	function targetRows(index: number): number[] {
		const selected = headerSel;
		if (selected?.kind === "row" && selected.indices.has(index)) {
			return currentVisibleRows().filter((rowIndex) => selected.indices.has(rowIndex));
		}
		return [index];
	}

	function selectAllRows() {
		headerSel = { kind: "row", indices: new SvelteSet(currentVisibleRows()) };
		selection = null;
	}

	function clearHeaderSelection() {
		headerSel = null;
	}

	function applyFilter(column: GridColumn, values: ReadonlySet<string>) {
		filters.set(column, new SvelteSet(values));
		cancelEdit();
		selection = null;
		headerSel = null;
	}

	function clearFilter(column: GridColumn) {
		filters.delete(column);
		cancelEdit();
		selection = null;
		headerSel = null;
	}

	function clearFilters() {
		filters.clear();
		cancelEdit();
		selection = null;
		headerSel = null;
	}

	function toggleSort(column: number) {
		if (sort?.column !== column) {
			sort = { column, direction: "ascending" };
		} else if (sort.direction === "ascending") {
			sort = { column, direction: "descending" };
		} else {
			sort = null;
		}
		cancelEdit();
		selection = null;
		headerSel = null;
	}

	function setVisibleRows(indices: readonly number[]) {
		if (
			visibleRows?.length === indices.length &&
			visibleRows.every((rowIndex, index) => rowIndex === indices[index])
		) {
			return;
		}
		visibleRows = [...indices];
		if (visibleRows.length > 0 && !visibleRows.includes(active.r)) {
			active = { r: visibleRows[0], c: active.c };
		}
	}

	/** Returns and clears a focus request caused by an explicit grid interaction. */
	function takeFocusRequest() {
		const shouldFocus = focusAfterCommit;
		focusAfterCommit = false;
		return shouldFocus;
	}

	function deleteRowAt(index: number) {
		const targets = targetRows(index).sort((a, b) => b - a);
		for (const i of targets) {
			const result = deleteRows(headers, rows, i, 1);
			headers = result.headers;
			rows = result.rows;
		}
		rows = normalizeNameRows(rows, headers.length);
		persist();
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
		persist();
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
		persist();
		if (headerSel?.kind === "row") {
			headerSel = { kind: "row", indices: new SvelteSet(targets.map((i) => i + 1)) };
		}
	}

	/** Insert an empty row directly above `index`. */
	function insertRowAbove(index: number) {
		if (rows.some((row) => !row[0]?.trim())) return;
		const result = insertRows(headers, rows, index, 1);
		headers = result.headers;
		rows = normalizeNameRows(result.rows, result.headers.length);
		persist();
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
		headers = applied.headers;
		rows = applied.rows;
		persist();
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
		cancelEdit();
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
		cancelEdit();
		selection = null;
		if (extend && headerSel?.kind === "row" && headerSel.indices.size > 0) {
			rowSelectionAnchor = currentVisibleRows().find((index) => headerSel?.indices.has(index)) ?? rowIndex;
			extendRowSelection(rowIndex);
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
		const rowsToSelect = currentVisibleRows();
		const anchorIndex = rowsToSelect.indexOf(rowSelectionAnchor);
		const rowIndexInVisibleRows = rowsToSelect.indexOf(rowIndex);
		if (anchorIndex < 0 || rowIndexInVisibleRows < 0) return;
		const from = Math.min(anchorIndex, rowIndexInVisibleRows);
		const to = Math.max(anchorIndex, rowIndexInVisibleRows);
		headerSel = {
			kind: "row",
			indices: new SvelteSet(rowsToSelect.slice(from, to + 1))
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
			rows = normalizeNameRows(rows, headers.length);
			persist();
			headerSel = null;
			// Move active to a valid cell
			if (active.r >= rows.length) {
				active.r = Math.max(0, rows.length - 1);
			}
		} else if (headerSel.kind === "col") {
			const removed = Array.from(headerSel.indices)
				.filter((index) => index > 0)
				.sort((left, right) => left - right);
			const remapColumn = (column: number) => {
				if (removed.includes(column)) return null;
				return column - removed.filter((index) => index < column).length;
			};
			const result = deleteColumns(headers, rows, headerSel.indices);
			headers = result.headers;
			rows = normalizeNameRows(result.rows, result.headers.length);
			const nextFilters = new SvelteMap<GridColumn, SvelteSet<string>>();
			for (const [column, values] of filters) {
				if (typeof column === "string") nextFilters.set(column, values);
				else {
					const nextColumn = remapColumn(column);
					if (nextColumn !== null) nextFilters.set(nextColumn, values);
				}
			}
			filters.clear();
			for (const [column, values] of nextFilters) filters.set(column, values);
			if (sort) {
				const nextColumn = remapColumn(sort.column);
				sort = nextColumn === null ? null : { ...sort, column: nextColumn };
			}
			persist();
			headerSel = null;
			const nextActiveColumn = remapColumn(active.c);
			active.c = Math.max(
				0,
				Math.min(
					nextActiveColumn ?? active.c - removed.filter((index) => index < active.c).length,
					headers.length - 1
				)
			);
		}
	}

	function copySelection(): string {
		if (!selection) {
			// Copy single active cell
			const value = rows[active.r]?.[active.c] ?? "";
			return value + "\n";
		}
		const norm = normalizeRange(selection);
		const displayedRows = currentVisibleRows();
		const anchor = displayedRows.indexOf(selection.anchor.r);
		const focus = displayedRows.indexOf(selection.focus.r);
		const selectedRows =
			anchor >= 0 && focus >= 0
				? displayedRows
						.slice(Math.min(anchor, focus), Math.max(anchor, focus) + 1)
						.map((index) => rows[index] ?? [])
				: rows.slice(norm.minRow, norm.maxRow + 1);
		return serializeGridRange(
			selectedRows.map((row) => row.slice(norm.minCol, norm.maxCol + 1)),
			{ from: 0, to: norm.maxCol - norm.minCol }
		);
	}

	return {
		// State (for bindings/derived)
		get headers() {
			return headers;
		},
		set headers(value: string[]) {
			headers = normalizeHeaders(value);
			rows = normalizeNameRows(rows, headers.length);
			persist();
		},
		get rows() {
			return rows;
		},
		set rows(value: string[][]) {
			rows = normalizeNameRows(value, headers.length);
			persist();
		},
		get active() {
			return active;
		},
		get editing() {
			return editing;
		},
		get editingValue() {
			return editingValue;
		},
		get selection() {
			return selection;
		},
		get headerSel() {
			return headerSel;
		},
		get filters() {
			return filters;
		},
		get hasFilters() {
			return filters.size > 0;
		},
		get sort() {
			return sort;
		},
		get visibleRows() {
			return visibleRows ?? [];
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
		applyFilter,
		clearFilter,
		clearFilters,
		toggleSort,
		setVisibleRows,
		takeFocusRequest,
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
