import type { Point } from "@maply/model/types";

/** An axis-aligned rectangle stored in the document spatial index. */
export type SpatialBounds = {
	x: number;
	y: number;
	width: number;
	height: number;
};

/** A mutable uniform-grid index for rectangle candidates. */
export type SpatialIndex = {
	readonly set: (id: string, bounds: SpatialBounds) => void;
	readonly delete: (id: string) => void;
	readonly clear: () => void;
	readonly query: (bounds: SpatialBounds) => string[];
	readonly queryPoint: (point: Point) => string[];
};

const DEFAULT_CELL_SIZE = 512;

function intersects(left: SpatialBounds, right: SpatialBounds): boolean {
	return (
		left.x <= right.x + right.width &&
		left.x + left.width >= right.x &&
		left.y <= right.y + right.height &&
		left.y + left.height >= right.y
	);
}

function contains(bounds: SpatialBounds, point: Point): boolean {
	return (
		point.x >= bounds.x &&
		point.x <= bounds.x + bounds.width &&
		point.y >= bounds.y &&
		point.y <= bounds.y + bounds.height
	);
}

/** Creates a uniform-grid spatial index with exact bounds filtering after candidate lookup. */
export function createSpatialIndex(cellSize = DEFAULT_CELL_SIZE): SpatialIndex {
	const entries = new Map<string, SpatialBounds>();
	const memberships = new Map<string, string[]>();
	const cells = new Map<string, Set<string>>();
	const size = Math.max(1, cellSize);

	function cellCoordinate(value: number) {
		return Math.floor(value / size);
	}

	function cellKey(x: number, y: number) {
		return `${x}:${y}`;
	}

	function cellsFor(bounds: SpatialBounds): string[] {
		const minX = cellCoordinate(bounds.x);
		const minY = cellCoordinate(bounds.y);
		const maxX = cellCoordinate(bounds.x + Math.max(0, bounds.width));
		const maxY = cellCoordinate(bounds.y + Math.max(0, bounds.height));
		const keys: string[] = [];

		for (let x = minX; x <= maxX; x += 1) {
			for (let y = minY; y <= maxY; y += 1) keys.push(cellKey(x, y));
		}
		return keys;
	}

	function removeFromCells(id: string) {
		for (const key of memberships.get(id) ?? []) {
			const cell = cells.get(key);
			if (!cell) continue;
			cell.delete(id);
			if (cell.size === 0) cells.delete(key);
		}
		memberships.delete(id);
	}

	return {
		set: (id, bounds) => {
			removeFromCells(id);
			entries.set(id, { ...bounds });
			const keys = cellsFor(bounds);
			memberships.set(id, keys);
			for (const key of keys) {
				const cell = cells.get(key) ?? new Set<string>();
				cell.add(id);
				cells.set(key, cell);
			}
		},
		delete: (id) => {
			removeFromCells(id);
			entries.delete(id);
		},
		clear: () => {
			entries.clear();
			memberships.clear();
			cells.clear();
		},
		query: (bounds) => {
			const candidates = new Set<string>();
			for (const key of cellsFor(bounds)) {
				for (const id of cells.get(key) ?? []) candidates.add(id);
			}
			return [...candidates].filter((id) => {
				const entry = entries.get(id);
				return entry ? intersects(entry, bounds) : false;
			});
		},
		queryPoint: (point) => {
			const key = cellKey(cellCoordinate(point.x), cellCoordinate(point.y));
			return [...(cells.get(key) ?? [])].filter((id) => {
				const entry = entries.get(id);
				return entry ? contains(entry, point) : false;
			});
		}
	};
}
