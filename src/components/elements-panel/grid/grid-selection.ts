import type { CellAddr } from "./grid-model";

export interface Range {
	anchor: CellAddr;
	focus: CellAddr;
}

/** Normalize range to {min/max rows, min/max cols}. */
export interface NormalizedRange {
	minRow: number;
	maxRow: number;
	minCol: number;
	maxCol: number;
}

export function normalizeRange(range: Range): NormalizedRange {
	const minRow = Math.min(range.anchor.r, range.focus.r);
	const maxRow = Math.max(range.anchor.r, range.focus.r);
	const minCol = Math.min(range.anchor.c, range.focus.c);
	const maxCol = Math.max(range.anchor.c, range.focus.c);
	return { minRow, maxRow, minCol, maxCol };
}

/** Check if cell is within a normalized range. */
export function isInRange(addr: CellAddr, range: NormalizedRange): boolean {
	return addr.r >= range.minRow && addr.r <= range.maxRow && addr.c >= range.minCol && addr.c <= range.maxCol;
}

/** Visual state of a cell. Precedence: editing > active > selected > normal. */
export type CellStatus = "normal" | "selected" | "active" | "editing";

/** Determine cell status given addresses and states. */
export function cellStatus(
	addr: CellAddr,
	active: CellAddr | null,
	selection: Range | null,
	editing: CellAddr | null
): CellStatus {
	if (editing && editing.r === addr.r && editing.c === addr.c) return "editing";
	if (active && active.r === addr.r && active.c === addr.c) return "active";
	if (selection) {
		const norm = normalizeRange(selection);
		if (isInRange(addr, norm)) return "selected";
	}
	return "normal";
}

/** Handle header selection with Shift (contiguous) and Ctrl/Cmd (toggle). */
export function updateHeaderSelection(
	current: Set<number> | null,
	index: number,
	shift: boolean,
	ctrl: boolean
): Set<number> | null {
	const next = current ? new Set(current) : new Set<number>();

	if (ctrl) {
		// Toggle this index
		if (next.has(index)) {
			next.delete(index);
		} else {
			next.add(index);
		}
	} else if (shift && next.size > 0) {
		// Contiguous range from min to this index
		const indices = Array.from(next);
		const min = Math.min(...indices);
		const max = Math.max(...indices);
		const newMin = Math.min(min, index);
		const newMax = Math.max(max, index);
		next.clear();
		for (let i = newMin; i <= newMax; i++) {
			next.add(i);
		}
	} else {
		// Plain click: if this is already the only selection, deselect it;
		// otherwise (nothing, or a different/multi selection) select just this one.
		if (next.size === 1 && next.has(index)) {
			next.clear();
		} else {
			next.clear();
			next.add(index);
		}
	}

	return next.size === 0 ? null : next;
}
