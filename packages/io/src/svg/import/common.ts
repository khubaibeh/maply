import type { Element, Point, Project } from "@maply/model/types";

import { isRecord } from "../../common";
import { SvgImportWarningType, type SvgImportWarning } from "../types";

type DraftProject = { -readonly [Key in keyof Project]: Project[Key] };

export { isRecord };

export function decodeXml(value: string) {
	return value
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&amp;/g, "&");
}

export function attributes(tag: string) {
	const result = new Map<string, string>();
	for (const match of tag.matchAll(/([:\w-]+)\s*=\s*(["'])([\s\S]*?)\2/g)) result.set(match[1], decodeXml(match[3]));
	return result;
}

export function number(attrs: Map<string, string>, key: string) {
	const value = Number(attrs.get(key));
	return attrs.has(key) && Number.isFinite(value) ? value : null;
}

export function viewBox(attrs: Map<string, string>) {
	const values = attrs
		.get("viewBox")
		?.trim()
		.split(/[\s,]+/)
		.map(Number);

	return values?.length === 4 && values.every(Number.isFinite)
		? { minX: values[0], minY: values[1], width: values[2], height: values[3] }
		: null;
}

export function id() {
	return `svg-${crypto.randomUUID()}`;
}

export function name(attrs: Map<string, string>, fallback: string) {
	return attrs.get("id")?.trim() || fallback;
}

/**
 * Extracts coordinate points from an SVG path `d` string.
 * Only supports M/L/H/V commands (move-to, line-to, horizontal, vertical) in both
 * absolute and relative forms. Returns [] for paths containing curves (C/S/Q/T/A).
 * After a move command, implicit subsequent coordinates are treated as line-to (SVG spec).
 */
export function pathPoints(d: string) {
	const tokens = d.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?/g) ?? [];
	const points: Point[] = [];
	let index = 0;
	let command = "";
	let current = { x: 0, y: 0 };

	while (index < tokens.length) {
		if (/^[a-zA-Z]$/.test(tokens[index])) command = tokens[index++];
		else if (!command) return [];

		const upper = command.toUpperCase();
		const count = upper === "H" || upper === "V" ? 1 : upper === "M" || upper === "L" ? 2 : 0;
		if (!count) return [];

		const values = tokens.slice(index, index + count).map(Number);
		if (values.length !== count || values.some((value) => !Number.isFinite(value))) return [];
		index += count;

		const relative = command !== upper;
		current =
			upper === "H"
				? { x: relative ? current.x + values[0] : values[0], y: current.y }
				: upper === "V"
					? { x: current.x, y: relative ? current.y + values[0] : values[0] }
					: {
							x: relative ? current.x + values[0] : values[0],
							y: relative ? current.y + values[1] : values[1]
						};

		points.push(current);
		if (upper === "M") command = relative ? "l" : "L";
	}

	return points;
}

export function pathData(points: readonly Point[], closed: boolean) {
	return (
		points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ") + (closed ? " Z" : "")
	);
}

/** Computes the axis-aligned bounding box of an element in its own coordinate space. */
export function bounds(element: Element) {
	if (element.type === "circle")
		return { x: element.cx - element.r, y: element.cy - element.r, width: element.r * 2, height: element.r * 2 };

	if (element.type === "path") {
		const points = pathPoints(element.d);
		const xs = points.map((point) => point.x);
		const ys = points.map((point) => point.y);
		return points.length
			? {
					x: Math.min(...xs),
					y: Math.min(...ys),
					width: Math.max(...xs) - Math.min(...xs),
					height: Math.max(...ys) - Math.min(...ys)
				}
			: { x: element.x, y: element.y, width: 0, height: 0 };
	}

	return { x: element.x, y: element.y, width: element.width, height: element.height };
}

function translate(element: Element, x: number, y: number): Element {
	return element.type === "circle"
		? { ...element, cx: element.cx + x, cy: element.cy + y }
		: { ...element, x: element.x + x, y: element.y + y };
}

/**
 * Mutates the project to shrink-wrap the canvas around all elements.
 * Translates every element so the top-left corner sits at (0, 0).
 * Uses `fallback` dimensions when the project has no elements.
 */
export function fitCanvas(project: DraftProject, fallback: { width: number; height: number }) {
	if (!project.elements.length) {
		project.canvas = {
			...project.canvas,
			width: Math.max(1, Math.round(fallback.width)),
			height: Math.max(1, Math.round(fallback.height)),
			x: 0,
			y: 0
		};
		return;
	}

	const all = project.elements.map(bounds);
	const minX = Math.min(...all.map((item) => item.x));
	const minY = Math.min(...all.map((item) => item.y));
	const maxX = Math.max(...all.map((item) => item.x + item.width));
	const maxY = Math.max(...all.map((item) => item.y + item.height));

	project.elements = project.elements.map((element) => translate(element, -minX, -minY));
	project.canvas = {
		...project.canvas,
		width: Math.max(1, Math.round(maxX - minX)),
		height: Math.max(1, Math.round(maxY - minY)),
		x: 0,
		y: 0
	};
}

/** Renames elements with duplicate IDs by assigning fresh UUIDs, emitting warnings for each rename. */
export function dedupe(elements: readonly Element[], warnings: SvgImportWarning[]) {
	const used = new Set<string>();

	return elements.map((element) => {
		if (!used.has(element.id)) {
			used.add(element.id);
			return element;
		}

		const next = id();
		used.add(next);
		warnings.push({
			type: SvgImportWarningType.DuplicateElementId,
			message: `Renamed repeated SVG element id ${element.id}.`,
			source: { elementId: element.id }
		});
		return { ...element, id: next };
	});
}
