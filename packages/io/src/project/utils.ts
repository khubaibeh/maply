import { createDefaultProject, hasValidImageRect } from "@maply/model";
import type { Element, Project, StoredImageAsset } from "@maply/model/types";

import { TEXT_CHARACTER_WIDTH_RATIO, TEXT_LINE_HEIGHT_RATIO } from "../common";

export type AssetReferenceIssue =
	| {
			type: "duplicateAsset";
			assetId: string;
	  }
	| {
			type: "missingAsset";
			assetId: string;
			elementId: string;
	  };

function estimateSingleLineTextWidth(text: string, fontSize: number) {
	return Math.max(1, text.length * fontSize * TEXT_CHARACTER_WIDTH_RATIO);
}

function estimateTextBoxHeight(fontSize: number, text: string) {
	return Math.max(1, Math.ceil(text.split("\n").length * fontSize * TEXT_LINE_HEIGHT_RATIO));
}

/**
 * Repairs derived fields that older project files may have omitted or serialized inconsistently.
 * Schema decoding follows this function, so it deliberately preserves authoritative user data.
 */
export function normalizeElement(element: Element): Element {
	if (element.type === "path") {
		const closed = /\s*[Zz]\s*$/.test(element.d);
		return {
			...element,
			closed,
			strokeWidth: closed ? 0 : element.strokeWidth,
			fill: closed ? element.fill : "none"
		};
	}

	if (element.type === "text") {
		return {
			...element,
			width: element.width >= 1 ? element.width : estimateSingleLineTextWidth(element.text, element.fontSize),
			height: element.height >= 1 ? element.height : estimateTextBoxHeight(element.fontSize, element.text)
		};
	}

	if (element.type === "image") {
		const hasImageRect = hasValidImageRect(element);
		const image = { ...element };
		delete image.href;
		delete image.imageX;
		delete image.imageY;
		delete image.imageWidth;
		delete image.imageHeight;

		return {
			...image,
			...(typeof element.href === "string" ? { href: element.href } : {}),
			...(hasImageRect
				? {
						imageX: element.imageX,
						imageY: element.imageY,
						imageWidth: element.imageWidth,
						imageHeight: element.imageHeight
					}
				: {}),
			cropX: Math.min(100, Math.max(-100, element.cropX)),
			cropY: Math.min(100, Math.max(-100, element.cropY)),
			cropScale: Math.max(100, element.cropScale)
		};
	}

	return element;
}

/** Merges current defaults so older project payloads gain fields added after export. */
export function normalizeProject(project: Project): Project {
	return {
		...createDefaultProject(project.id),
		...project,
		canvas: {
			...project.canvas,
			width: Math.max(1, Math.round(project.canvas.width)),
			height: Math.max(1, Math.round(project.canvas.height)),
			x: Math.round(project.canvas.x),
			y: Math.round(project.canvas.y)
		},
		elements: project.elements.map(normalizeElement)
	};
}

export function getAssetReferenceIssue(
	project: Project,
	imageAssets: readonly StoredImageAsset[]
): AssetReferenceIssue | null {
	const assetIds = new Set<string>();

	for (const asset of imageAssets) {
		if (assetIds.has(asset.id)) return { type: "duplicateAsset", assetId: asset.id };
		assetIds.add(asset.id);
	}

	for (const element of project.elements) {
		if (element.type !== "image" || !element.assetId || assetIds.has(element.assetId)) continue;
		return { type: "missingAsset", assetId: element.assetId, elementId: element.id };
	}

	return null;
}
