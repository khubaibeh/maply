import type { Element } from "../../domain/elements";
import { defaultElementName } from "./naming";
import { estimateSingleLineTextWidth, estimateTextBoxHeight } from "./text";

export function normalizeElement(element: Element): Element {
	const normalized: Element = {
		...element,
		name: typeof element.name === "string" ? element.name : defaultElementName(element.type)
	};

	if (normalized.type === "path") {
		if (typeof normalized.x !== "number" || typeof normalized.y !== "number") {
			normalized.x = 0;
			normalized.y = 0;
		}
		if (typeof normalized.closed !== "boolean") {
			normalized.closed = /\s*[Zz]\s*$/.test(normalized.d);
		}
		if (normalized.closed) {
			normalized.strokeWidth = 0;
		} else {
			normalized.fill = "none";
		}
	}

	if (normalized.type === "text" && (typeof normalized.width !== "number" || normalized.width < 1)) {
		normalized.width = estimateSingleLineTextWidth(normalized.text, normalized.fontSize);
	}

	if (normalized.type === "text" && (typeof normalized.height !== "number" || normalized.height < 1)) {
		normalized.height = estimateTextBoxHeight(normalized.fontSize, normalized.text);
	}

	if (normalized.type === "image") {
		normalized.assetId = typeof normalized.assetId === "string" ? normalized.assetId : null;
		normalized.cropX = typeof normalized.cropX === "number" ? Math.min(100, Math.max(-100, normalized.cropX)) : 0;
		normalized.cropY = typeof normalized.cropY === "number" ? Math.min(100, Math.max(-100, normalized.cropY)) : 0;
		normalized.cropScale = typeof normalized.cropScale === "number" ? Math.max(100, normalized.cropScale) : 100;
	}

	return normalized;
}

export function normalizeElements(elements: Element[]): Element[] {
	return elements.map(normalizeElement);
}
