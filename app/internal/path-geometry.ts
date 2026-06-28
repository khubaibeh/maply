import type { Point } from "../domain/geometry";

export type PathBounds = {
	x: number;
	y: number;
	width: number;
	height: number;
};

const TOKEN_PATTERN = /[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?/g;

export function getPathDataBounds(points: Point[]): PathBounds {
	if (points.length === 0) {
		return { x: 0, y: 0, width: 0, height: 0 };
	}

	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;

	for (const point of points) {
		minX = Math.min(minX, point.x);
		minY = Math.min(minY, point.y);
		maxX = Math.max(maxX, point.x);
		maxY = Math.max(maxY, point.y);
	}

	return {
		x: minX,
		y: minY,
		width: maxX - minX,
		height: maxY - minY
	};
}

export function pathDataFromPoints(points: Point[], closed: boolean): string {
	if (points.length === 0) return "";

	const [first, ...rest] = points;
	let d = `M${round(first.x)},${round(first.y)}`;

	for (const point of rest) {
		d += ` L${round(point.x)},${round(point.y)}`;
	}

	if (closed) {
		d += " Z";
	}

	return d;
}

export function getPathPoints(d: string): Point[] {
	const tokens = d.match(TOKEN_PATTERN) ?? [];
	const points: Point[] = [];

	let index = 0;
	let command = "";
	let current: Point = { x: 0, y: 0 };

	function readNumbers(count: number): number[] | null {
		const values: number[] = [];
		for (let offset = 0; offset < count; offset += 1) {
			const token = tokens[index + offset];
			if (!token || isCommand(token)) return null;
			const value = Number(token);
			if (!Number.isFinite(value)) return null;
			values.push(value);
		}
		index += count;
		return values;
	}

	while (index < tokens.length) {
		if (isCommand(tokens[index])) {
			command = tokens[index];
			index += 1;
		} else if (!command) {
			index += 1;
			continue;
		}

		const upperCommand = command.toUpperCase();
		const relative = command !== upperCommand;

		switch (upperCommand) {
			case "M": {
				const values = readNumbers(2);
				if (!values) return [];
				current = apply(values[0], values[1], relative, current);
				points.push(current);
				// Subsequent coordinate pairs after a moveto are treated as implicit lineto.
				command = relative ? "l" : "L";
				break;
			}
			case "L": {
				const values = readNumbers(2);
				if (!values) return [];
				current = apply(values[0], values[1], relative, current);
				points.push(current);
				break;
			}
			case "H": {
				const values = readNumbers(1);
				if (!values) return [];
				current = { x: relative ? current.x + values[0] : values[0], y: current.y };
				points.push(current);
				break;
			}
			case "V": {
				const values = readNumbers(1);
				if (!values) return [];
				current = { x: current.x, y: relative ? current.y + values[0] : values[0] };
				points.push(current);
				break;
			}
			case "Z": {
				// No coordinates consumed; closing the path does not add a new vertex.
				break;
			}
			default:
				// Unsupported command (curves, arcs, etc.) — bail out so we don't corrupt legacy paths.
				return [];
		}
	}

	return points;
}

export function updatePathVertex(d: string, index: number, point: Point): { d: string; bounds: PathBounds } {
	const points = getPathPoints(d);
	if (index < 0 || index >= points.length) {
		const currentPoints = getPathPoints(d);
		return { d, bounds: getPathDataBounds(currentPoints) };
	}

	const nextPoints = points.map((p, i) => (i === index ? point : p));
	const closed = /\s*[Zz]\s*$/.test(d);
	const nextD = pathDataFromPoints(nextPoints, closed);
	return { d: nextD, bounds: getPathDataBounds(nextPoints) };
}

function isCommand(token: string | undefined): boolean {
	return !!token && /^[a-zA-Z]$/.test(token);
}

function apply(x: number, y: number, relative: boolean, current: Point): Point {
	return relative ? { x: current.x + x, y: current.y + y } : { x, y };
}

function round(value: number): number {
	return Math.round(value);
}
