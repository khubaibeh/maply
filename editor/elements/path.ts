import type { Point } from "@maply/model/types";

const tokenPattern = /[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?/g;

/** Parses editable linear SVG path commands into absolute vertices. */
export function toPathPoints(d: string): Point[] {
	const tokens = d.match(tokenPattern) ?? [];
	const points: Point[] = [];

	let index = 0;
	let command = "";
	let current = { x: 0, y: 0 };

	while (index < tokens.length) {
		if (/^[a-zA-Z]$/.test(tokens[index])) command = tokens[index++];
		if (!command) return [];

		const upper = command.toUpperCase();
		if (upper === "Z") break;

		const count = upper === "H" || upper === "V" ? 1 : 2;
		const values = tokens.slice(index, index + count).map(Number);

		if (values.length !== count || values.some((value) => !Number.isFinite(value))) return [];
		index += count;

		const relative = command !== upper;

		if (upper === "H") {
			current = { ...current, x: relative ? current.x + values[0] : values[0] };
		} else if (upper === "V") {
			current = { ...current, y: relative ? current.y + values[0] : values[0] };
		} else if (upper === "M" || upper === "L") {
			current = {
				x: relative ? current.x + values[0] : values[0],
				y: relative ? current.y + values[1] : values[1]
			};
		} else {
			return [];
		}

		points.push(current);

		if (upper === "M") command = relative ? "l" : "L";
	}

	return points;
}

/** Serializes linear path vertices into canonical SVG path data. */
export function toPath(points: readonly Point[], closed: boolean): string {
	if (points.length === 0) return "";

	const [first, ...rest] = points;
	const segments = rest.map((p) => ` L${Math.round(p.x)},${Math.round(p.y)}`);

	return `M${Math.round(first.x)},${Math.round(first.y)}${segments.join("")}${closed ? " Z" : ""}`;
}
