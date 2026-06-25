import interCyrillicExtUrl from "@fontsource-variable/inter/files/inter-cyrillic-ext-standard-normal.woff2?url";
import interCyrillicUrl from "@fontsource-variable/inter/files/inter-cyrillic-standard-normal.woff2?url";
import interGreekExtUrl from "@fontsource-variable/inter/files/inter-greek-ext-standard-normal.woff2?url";
import interGreekUrl from "@fontsource-variable/inter/files/inter-greek-standard-normal.woff2?url";
import interLatinExtUrl from "@fontsource-variable/inter/files/inter-latin-ext-standard-normal.woff2?url";
import interLatinUrl from "@fontsource-variable/inter/files/inter-latin-standard-normal.woff2?url";
import interVietnameseUrl from "@fontsource-variable/inter/files/inter-vietnamese-standard-normal.woff2?url";

import type { Element, ImageElement, TextElement } from "../domain/elements";
import type { StoredImageAsset } from "../domain/image-assets";
import type { Project } from "../domain/project";
import {
	getPathRenderTransform,
	getWrappedTextLineHeight,
	getWrappedTextLines,
	getWrappedTextMetrics
} from "./element-actions";
import { getImageRenderRect } from "./image-assets";
import { createProjectFilePackage } from "./project-io";

const SVG_XMLNS = "http://www.w3.org/2000/svg";
const EMBEDDED_FONT_FAMILY = "Maply Export Inter";
const IMAGE_PLACEHOLDER_FILL = "#e5e5e5";
const IMAGE_PLACEHOLDER_STROKE = "#737373";
const SVG_METADATA_FORMAT = "maply-svg-recovery";
const SVG_METADATA_VERSION = 1;

type EmbeddedFontSource = {
	url: string;
	unicodeRange: string;
};

type SvgRecoveryMetadata = {
	format: typeof SVG_METADATA_FORMAT;
	version: typeof SVG_METADATA_VERSION;
	project: Project;
	imageAssets: Array<Pick<StoredImageAsset, "id" | "name" | "mimeType" | "width" | "height">>;
};

type BuildSvgExportOptions = {
	embeddedFontCss?: string;
};

const embeddedFontSources: EmbeddedFontSource[] = [
	{
		url: interCyrillicExtUrl,
		unicodeRange: "U+0460-052F,U+1C80-1C8A,U+20B4,U+2DE0-2DFF,U+A640-A69F,U+FE2E-FE2F"
	},
	{
		url: interCyrillicUrl,
		unicodeRange: "U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116"
	},
	{ url: interGreekExtUrl, unicodeRange: "U+1F00-1FFF" },
	{
		url: interGreekUrl,
		unicodeRange: "U+0370-0377,U+037A-037F,U+0384-038A,U+038C,U+038E-03A1,U+03A3-03FF"
	},
	{
		url: interVietnameseUrl,
		unicodeRange:
			"U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB"
	},
	{
		url: interLatinExtUrl,
		unicodeRange:
			"U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF"
	},
	{
		url: interLatinUrl,
		unicodeRange:
			"U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"
	}
];

let embeddedFontCssPromise: Promise<string> | null = null;

function escapeXml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

function escapeCdata(value: string): string {
	return value.replace(/]]>/g, "]]><![CDATA[>");
}

function toBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binary = "";

	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}

	return btoa(binary);
}

async function fetchFontAsDataUrl(url: string): Promise<string> {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to load export font: ${response.status}.`);
	}

	const buffer = await response.arrayBuffer();
	return `data:font/woff2;base64,${toBase64(buffer)}`;
}

export async function loadEmbeddedInterFontCss(): Promise<string> {
	if (embeddedFontCssPromise) return embeddedFontCssPromise;

	embeddedFontCssPromise = Promise.all(
		embeddedFontSources.map(async (source) => {
			const dataUrl = await fetchFontAsDataUrl(source.url);
			return [
				"@font-face {",
				`font-family: '${EMBEDDED_FONT_FAMILY}';`,
				"font-style: normal;",
				"font-display: block;",
				"font-weight: 100 900;",
				`src: url(${dataUrl}) format('woff2-variations');`,
				`unicode-range: ${source.unicodeRange};`,
				"}"
			].join("");
		})
	).then((chunks) => chunks.join("\n"));

	return embeddedFontCssPromise;
}

export function createSvgRecoveryMetadata(project: Project, imageAssets: StoredImageAsset[]): SvgRecoveryMetadata {
	const projectFile = createProjectFilePackage(project, imageAssets);

	return {
		format: SVG_METADATA_FORMAT,
		version: SVG_METADATA_VERSION,
		project: projectFile.project,
		imageAssets: projectFile.imageAssets.map((asset) => ({
			id: asset.id,
			name: asset.name,
			mimeType: asset.mimeType,
			width: asset.width,
			height: asset.height
		}))
	};
}

function buildSvgId(prefix: string, value: string): string {
	return `${prefix}-${value.replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
}

function getProjectOffset(project: Project) {
	return {
		x: -project.canvas.x,
		y: -project.canvas.y
	};
}

function renderTextElement(element: TextElement, offsetX: number, offsetY: number, defs: string[]): string {
	const wrappedLines = getWrappedTextLines(element);
	const lineHeight = getWrappedTextLineHeight(element);
	const textMetrics = getWrappedTextMetrics(element);
	const clipPathId = buildSvgId("text-clip", element.id);
	defs.push(
		`<clipPath id="${clipPathId}"><rect x="${element.x + offsetX - textMetrics.left}" y="${element.y + offsetY - textMetrics.ascent}" width="${element.width}" height="${element.height}" /></clipPath>`
	);

	const tspans = wrappedLines
		.map((line, index) => {
			const dy = index === 0 ? "0" : `${lineHeight}px`;
			return `<tspan x="${element.x + offsetX}" dy="${dy}">${escapeXml(line || " ")}</tspan>`;
		})
		.join("");

	return `<text id="${escapeXml(element.name)}" x="${element.x + offsetX}" y="${element.y + offsetY}" font-size="${element.fontSize}" font-family="${escapeXml(EMBEDDED_FONT_FAMILY)}" fill="${escapeXml(element.fill)}" xml:space="preserve" clip-path="url(#${clipPathId})" text-rendering="geometricPrecision">${tspans}</text>`;
}

function renderImagePlaceholder(element: ImageElement, offsetX: number, offsetY: number): string {
	const pathTranslateX = element.x + offsetX + element.width / 2 - 18;
	const pathTranslateY = element.y + offsetY + element.height / 2 - 16;
	return [
		`<rect x="${element.x + offsetX}" y="${element.y + offsetY}" width="${element.width}" height="${element.height}" fill="${IMAGE_PLACEHOLDER_FILL}" />`,
		`<path d="M0 0h18l5 6h13v18H0z" fill="none" stroke="${IMAGE_PLACEHOLDER_STROKE}" stroke-width="1.5" transform="translate(${pathTranslateX}, ${pathTranslateY})" />`,
		`<line x1="${element.x + offsetX + 14}" y1="${element.y + offsetY + element.height - 14}" x2="${element.x + offsetX + element.width - 14}" y2="${element.y + offsetY + 14}" stroke="${IMAGE_PLACEHOLDER_STROKE}" stroke-opacity="0.35" stroke-width="2" stroke-linecap="round" />`
	].join("");
}

function renderImageElement(
	element: ImageElement,
	imageAsset: StoredImageAsset | null,
	offsetX: number,
	offsetY: number
): string {
	const imageHref = imageAsset?.dataUrl ?? element.href ?? "";
	if (!imageHref) return renderImagePlaceholder(element, offsetX, offsetY);

	if (imageAsset) {
		const renderRect = getImageRenderRect({
			x: element.x + offsetX,
			y: element.y + offsetY,
			width: element.width,
			height: element.height,
			assetWidth: imageAsset.width,
			assetHeight: imageAsset.height,
			cropX: element.cropX,
			cropY: element.cropY,
			cropScale: element.cropScale
		});
		const localX = renderRect.x - (element.x + offsetX);
		const localY = renderRect.y - (element.y + offsetY);

		return [
			`<g id="${escapeXml(element.name)}">`,
			`<rect x="${element.x + offsetX}" y="${element.y + offsetY}" width="${element.width}" height="${element.height}" fill="${IMAGE_PLACEHOLDER_FILL}" />`,
			`<svg x="${element.x + offsetX}" y="${element.y + offsetY}" width="${element.width}" height="${element.height}" viewBox="0 0 ${element.width} ${element.height}" overflow="hidden">` +
				`<image data-maply-asset-id="${escapeXml(imageAsset.id)}" x="${localX}" y="${localY}" width="${renderRect.width}" height="${renderRect.height}" href="${escapeXml(imageHref)}" preserveAspectRatio="none" />` +
				"</svg>",
			"</g>"
		].join("");
	}

	return (
		`<g id="${escapeXml(element.name)}">` +
		`<svg x="${element.x + offsetX}" y="${element.y + offsetY}" width="${element.width}" height="${element.height}" viewBox="0 0 ${element.width} ${element.height}" overflow="hidden">` +
		`<image x="0" y="0" width="${element.width}" height="${element.height}" href="${escapeXml(imageHref)}" preserveAspectRatio="xMidYMid slice" />` +
		"</svg>" +
		"</g>"
	);
}

function renderElement(
	element: Element,
	imageAssets: Map<string, StoredImageAsset>,
	offsetX: number,
	offsetY: number,
	defs: string[]
): string {
	switch (element.type) {
		case "rect":
			return `<rect id="${escapeXml(element.name)}" x="${element.x + offsetX}" y="${element.y + offsetY}" width="${element.width}" height="${element.height}" fill="${escapeXml(element.fill)}" stroke="${escapeXml(element.stroke)}" stroke-width="${element.strokeWidth}" />`;
		case "circle":
			return `<circle id="${escapeXml(element.name)}" cx="${element.cx + offsetX}" cy="${element.cy + offsetY}" r="${element.r}" fill="${escapeXml(element.fill)}" stroke="${escapeXml(element.stroke)}" stroke-width="${element.strokeWidth}" />`;
		case "path": {
			const transform = getPathRenderTransform(element);
			return `<path id="${escapeXml(element.name)}" transform="translate(${transform.x + offsetX}, ${transform.y + offsetY})" d="${escapeXml(element.d)}" fill="${escapeXml(element.fill)}" stroke="${escapeXml(element.stroke)}" stroke-width="${element.strokeWidth}" />`;
		}
		case "text":
			return renderTextElement(element, offsetX, offsetY, defs);
		case "image":
			return renderImageElement(
				element,
				element.assetId ? (imageAssets.get(element.assetId) ?? null) : null,
				offsetX,
				offsetY
			);
	}
}

export function buildSvgExport(
	project: Project,
	imageAssets: StoredImageAsset[],
	options: BuildSvgExportOptions = {}
): string {
	const defs: string[] = [];
	const imageAssetMap = new Map(imageAssets.map((asset) => [asset.id, asset]));
	const metadata = JSON.stringify(createSvgRecoveryMetadata(project, imageAssets));
	const offset = getProjectOffset(project);

	if (options.embeddedFontCss) {
		defs.push(`<style><![CDATA[${options.embeddedFontCss}]]></style>`);
	}

	const content = project.elements
		.map((element) => renderElement(element, imageAssetMap, offset.x, offset.y, defs))
		.join("");
	const defsMarkup = defs.length > 0 ? `<defs>${defs.join("")}</defs>` : "";

	return [
		`<svg xmlns="${SVG_XMLNS}" width="${project.canvas.width}" height="${project.canvas.height}" viewBox="0 0 ${project.canvas.width} ${project.canvas.height}" fill="none">`,
		`<metadata id="maply-recovery"><![CDATA[${escapeCdata(metadata)}]]></metadata>`,
		defsMarkup,
		`<rect x="0" y="0" width="${project.canvas.width}" height="${project.canvas.height}" fill="${escapeXml(project.canvas.color)}" />`,
		content,
		"</svg>"
	].join("");
}

export async function exportProjectSvg(project: Project, imageAssets: StoredImageAsset[]): Promise<string> {
	const embeddedFontCss = await loadEmbeddedInterFontCss();
	return buildSvgExport(project, imageAssets, { embeddedFontCss });
}
