import { getImageRenderRect } from "@maply/model";
import type { Element, ImageElement, Project, StoredImageAsset, TextElement } from "@maply/model/types";

import { TEXT_CHARACTER_WIDTH_RATIO, TEXT_LINE_HEIGHT_RATIO } from "../../common";
import { pathPoints } from "../import/common";
import type { SvgOptions } from "../types";

const XMLNS = "http://www.w3.org/2000/svg";
const IMAGE_FILL = "#e5e5e5";
const IMAGE_STROKE = "#737373";
const RECOVERY_FORMAT = "maply-svg-recovery";
const RECOVERY_VERSION = 1;

export type SvgMetadata = {
	format: typeof RECOVERY_FORMAT;
	version: typeof RECOVERY_VERSION;
	project: Project;
	imageAssets: Array<Omit<StoredImageAsset, "dataUrl">>;
};

function escapeXml(value: string) {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

/* Escapes `]]>` inside CDATA sections by splitting into adjacent CDATA blocks. */
function escapeCdata(value: string) {
	return value.replace(/]]>/g, "]]<![CDATA[");
}

function pathBounds(d: string) {
	const points = pathPoints(d);
	if (points.length === 0) return { x: 0, y: 0 };
	return { x: Math.min(...points.map((point) => point.x)), y: Math.min(...points.map((point) => point.y)) };
}

/**
 * Word-wraps text into lines that fit the element's width.
 * Uses a 0.6 × fontSize approximation for average character width — not exact,
 * but sufficient for SVG clip-path rendering where overflow is hidden anyway.
 */
function textLines(element: TextElement) {
	const width = Math.max(1, element.width);
	const maxChars = Math.max(1, Math.floor(width / Math.max(1, element.fontSize * TEXT_CHARACTER_WIDTH_RATIO)));

	return element.text.split("\n").flatMap((paragraph) => {
		const words = paragraph.split(/\s+/).filter(Boolean);
		if (words.length === 0) return [""];

		const lines: string[] = [];
		let line = "";
		for (const word of words) {
			const next = line ? `${line} ${word}` : word;
			if (line && next.length > maxChars) {
				lines.push(line);
				line = word;
			} else line = next;
		}
		lines.push(line);
		return lines;
	});
}

function renderText(element: TextElement, dx: number, dy: number, defs: string[]) {
	const clipId = `text-clip-${element.id.replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
	defs.push(
		[
			`<clipPath id="${clipId}">`,
			`<rect x="${element.x + dx}" y="${element.y + dy - element.fontSize}" width="${element.width}" height="${element.height}" />`,
			"</clipPath>"
		].join(" ")
	);

	const lineHeight = element.fontSize * TEXT_LINE_HEIGHT_RATIO;
	const spans = textLines(element)
		.map(
			(line, index) =>
				`<tspan x="${element.x + dx}" dy="${index === 0 ? 0 : `${lineHeight}px`}">${escapeXml(line || " ")}</tspan>`
		)
		.join(" ");

	return [
		`<text id="${escapeXml(element.name)}" x="${element.x + dx}" y="${element.y + dy}"`,
		` font-size="${element.fontSize}" fill="${escapeXml(element.fill)}" xml:space="preserve"`,
		` clip-path="url(#${clipId})" text-rendering="geometricPrecision">`,
		spans,
		"</text>"
	].join(" ");
}

/* Falls back to a placeholder rect when no image data is available. */
function renderImage(element: ImageElement, asset: StoredImageAsset | undefined, dx: number, dy: number) {
	const href = asset?.dataUrl ?? element.href ?? "";

	if (!href) {
		return [
			`<rect x="${element.x + dx}" y="${element.y + dy}" width="${element.width}"`,
			` height="${element.height}" fill="${IMAGE_FILL}" stroke="${IMAGE_STROKE}" />`
		].join(" ");
	}

	const rect = asset
		? getImageRenderRect(element, asset)
		: { x: 0, y: 0, width: element.width, height: element.height };
	return [
		`<g id="${escapeXml(element.name)}">`,
		`<svg x="${element.x + dx}" y="${element.y + dy}" width="${element.width}" height="${element.height}"`,
		` viewBox="0 0 ${element.width} ${element.height}" overflow="hidden">`,
		`<image${asset ? ` data-maply-asset-id="${escapeXml(asset.id)}"` : ""} x="${rect.x}" y="${rect.y}"`,
		`width="${rect.width}" height="${rect.height}" href="${escapeXml(href)}" preserveAspectRatio="none" />`,
		"</svg>",
		"</g>"
	].join(" ");
}

function renderElement(
	element: Element,
	assets: Map<string, StoredImageAsset>,
	dx: number,
	dy: number,
	defs: string[]
) {
	switch (element.type) {
		case "rect":
			return [
				`<rect id="${escapeXml(element.name)}" x="${element.x + dx}" y="${element.y + dy}"`,
				` width="${element.width}" height="${element.height}" fill="${escapeXml(element.fill)}"`,
				` stroke="${escapeXml(element.stroke)}" stroke-width="${element.strokeWidth}" />`
			].join(" ");

		case "circle":
			return [
				`<circle id="${escapeXml(element.name)}" cx="${element.cx + dx}" cy="${element.cy + dy}" r="${element.r}"`,
				` fill="${escapeXml(element.fill)}" stroke="${escapeXml(element.stroke)}"`,
				` stroke-width="${element.strokeWidth}" />`
			].join(" ");

		case "path": {
			const bounds = pathBounds(element.d);
			const strokePad = Math.ceil(element.strokeWidth / 2);
			return [
				`<path id="${escapeXml(element.name)}" transform="translate(${element.x - bounds.x + strokePad + dx}, ${element.y - bounds.y + strokePad + dy})"`,
				` d="${escapeXml(element.d)}" fill="${escapeXml(element.fill)}"`,
				` stroke="${escapeXml(element.stroke)}" stroke-width="${element.strokeWidth}" />`
			].join(" ");
		}

		case "text":
			return renderText(element, dx, dy, defs);

		case "image":
			return renderImage(element, element.assetId ? assets.get(element.assetId) : undefined, dx, dy);
	}
}

/**
 * Builds the recovery metadata object embedded in exported SVGs.
 * Strips dataUrl from assets — the actual image data is stored in <image> tags,
 * so the metadata only needs the asset descriptors for reassembly on import.
 */
export function buildMetadata(project: Project, imageAssets: readonly StoredImageAsset[]): SvgMetadata {
	const assetIds = new Set(
		project.elements.flatMap((element) => (element.type === "image" && element.assetId ? [element.assetId] : []))
	);

	return {
		format: RECOVERY_FORMAT,
		version: RECOVERY_VERSION,
		project,
		imageAssets: imageAssets
			.filter((asset) => assetIds.has(asset.id))
			.map((asset) => ({
				id: asset.id,
				projectId: asset.projectId,
				name: asset.name,
				mimeType: asset.mimeType,
				width: asset.width,
				height: asset.height
			}))
	};
}

export function render(project: Project, imageAssets: readonly StoredImageAsset[], options: SvgOptions = {}) {
	const defs: string[] = [];
	if (options.embeddedFontCss)
		defs.push(["<style><![CDATA[", escapeCdata(options.embeddedFontCss), "]]></style>"].join(" "));

	const assets = new Map(imageAssets.map((asset) => [asset.id, asset]));
	const dx = -project.canvas.x;
	const dy = -project.canvas.y;

	const content = project.elements.map((element) => renderElement(element, assets, dx, dy, defs)).join(" ");
	const metadata = escapeCdata(JSON.stringify(buildMetadata(project, imageAssets)));
	const definitions = defs.length > 0 ? ["<defs>", defs.join(" "), "</defs>"].join(" ") : "";

	return [
		`<svg xmlns="${XMLNS}" width="${project.canvas.width}" height="${project.canvas.height}"`,
		` viewBox="0 0 ${project.canvas.width} ${project.canvas.height}" fill="none">`,
		'<metadata id="maply-recovery"><![CDATA[',
		metadata,
		"]]></metadata>",
		definitions,
		`<rect x="0" y="0" width="${project.canvas.width}" height="${project.canvas.height}" fill="${escapeXml(project.canvas.color)}" />`,
		content,
		"</svg>"
	].join(" ");
}
