import type { Element } from "@maply/model/types";

import { defaultElementName } from "../elements/naming";

function textWidth(text: string, fontSize: number): number {
	return Math.max(1, Math.round(Math.max(text.length, 1) * fontSize * 0.6));
}

function textHeight(text: string, fontSize: number): number {
	return Math.max(1, Math.ceil(fontSize * (1.2 + Math.max(0, text.split("\n").length - 1) * 1.2)));
}

/** Restores fields absent or invalid in projects persisted by older releases. */
export function normalizeElement(element: Element): Element {
	const normalized = {
		...element,
		name: typeof element.name === "string" ? element.name : defaultElementName(element.type)
	} as Element;

	if (normalized.type === "path") {
		const x = typeof normalized.x === "number" ? normalized.x : 0;
		const y = typeof normalized.y === "number" ? normalized.y : 0;
		const closed = typeof normalized.closed === "boolean" ? normalized.closed : /\s*[Zz]\s*$/.test(normalized.d);

		return {
			...normalized,
			x,
			y,
			closed,
			strokeWidth: closed ? 0 : normalized.strokeWidth,
			fill: closed ? normalized.fill : "none"
		};
	}

	if (normalized.type === "text") {
		return {
			...normalized,
			width:
				typeof normalized.width === "number" && normalized.width >= 1
					? normalized.width
					: textWidth(normalized.text, normalized.fontSize),
			height:
				typeof normalized.height === "number" && normalized.height >= 1
					? normalized.height
					: textHeight(normalized.text, normalized.fontSize)
		};
	}

	if (normalized.type === "image") {
		return {
			...normalized,
			assetId: typeof normalized.assetId === "string" ? normalized.assetId : null,
			cropX: typeof normalized.cropX === "number" ? Math.min(100, Math.max(-100, normalized.cropX)) : 0,
			cropY: typeof normalized.cropY === "number" ? Math.min(100, Math.max(-100, normalized.cropY)) : 0,
			cropScale: typeof normalized.cropScale === "number" ? Math.max(100, normalized.cropScale) : 100
		};
	}

	return normalized;
}
