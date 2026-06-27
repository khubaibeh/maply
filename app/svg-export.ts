import type { Element, ImageElement, PathElement, TextElement } from "./domain/elements";
import type { Point } from "./domain/geometry";
import type { StoredImageAsset } from "./domain/image-assets";
import type { Project } from "./domain/project";
import { createProjectFilePackage } from "./project-file";

const SVG_XMLNS = "http://www.w3.org/2000/svg";
const FONT_FAMILY = "Maply Export Inter";
const TEXT_FONT_FAMILY = '"Inter Variable", sans-serif';
const IMAGE_FILL = "#e5e5e5";
const IMAGE_STROKE = "#737373";
const METADATA_FORMAT = "maply-svg-recovery";
const METADATA_VERSION = 1;
const TEXT_LINE_HEIGHT_RATIO = 1.2;
const TOKEN_PATTERN = /[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?/g;

type SvgOptions = {
	embeddedFontCss?: string;
};

let fontCssPromise: Promise<string> | null = null;
let measureCtx: CanvasRenderingContext2D | null | undefined;

function escapeXml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

function escapeCdata(value: string): string {
	return value.replace(/]]>/g, "]]<![CDATA[>");
}

export async function loadEmbeddedInterFontCss(): Promise<string> {
	if (fontCssPromise) return fontCssPromise;
	fontCssPromise = Promise.resolve("");

	return fontCssPromise;
}

function getMeasureCtx() {
	if (measureCtx !== undefined) return measureCtx;
	if (typeof document === "undefined") {
		measureCtx = null;
		return measureCtx;
	}

	measureCtx = document.createElement("canvas").getContext("2d");
	return measureCtx;
}

function measureTextWidth(text: string, fontSize: number): number {
	const ctx = getMeasureCtx();
	if (!ctx) return Math.max(1, text.length * fontSize * 0.6);
	ctx.font = `${fontSize}px ${TEXT_FONT_FAMILY}`;
	return ctx.measureText(text || " ").width;
}

function wrapText(text: string, width: number, fontSize: number): string[] {
	const lines: string[] = [];
	const paragraphs = text.split("\n");

	for (const paragraph of paragraphs) {
		const words = paragraph.split(/\s+/).filter(Boolean);
		if (words.length === 0) {
			lines.push("");
			continue;
		}

		let line = words[0];
		for (const word of words.slice(1)) {
			const next = `${line} ${word}`;
			if (measureTextWidth(next, fontSize) <= width) {
				line = next;
				continue;
			}

			lines.push(line);
			line = word;
		}

		lines.push(line);
	}

	return lines.length > 0 ? lines : [""];
}

function getTextLayout(element: TextElement) {
	const lines = wrapText(element.text, element.width, element.fontSize);
	const lineHeight = element.fontSize * TEXT_LINE_HEIGHT_RATIO;
	const ctx = getMeasureCtx();

	if (!ctx) {
		return {
			lines,
			lineHeight,
			left: 0,
			ascent: element.fontSize,
			right: Math.max(1, ...lines.map((line) => measureTextWidth(line, element.fontSize)))
		};
	}

	ctx.font = `${element.fontSize}px ${TEXT_FONT_FAMILY}`;
	let left = 0;
	let right = 0;
	let ascent = element.fontSize;

	for (const line of lines) {
		const metrics = ctx.measureText(line || " ");
		left = Math.max(left, metrics.actualBoundingBoxLeft ?? 0);
		right = Math.max(right, metrics.actualBoundingBoxRight ?? metrics.width);
		ascent = Math.max(ascent, metrics.actualBoundingBoxAscent ?? element.fontSize);
	}

	return { lines, lineHeight, left, ascent, right };
}

function getPathPoints(d: string): Point[] {
	const tokens = d.match(TOKEN_PATTERN) ?? [];
	const points: Point[] = [];
	let i = 0;
	let cmd = "";
	let current: Point = { x: 0, y: 0 };

	function readNumbers(count: number): number[] | null {
		const values: number[] = [];
		for (let offset = 0; offset < count; offset += 1) {
			const token = tokens[i + offset];
			if (!token || /^[a-zA-Z]$/.test(token)) return null;
			const value = Number(token);
			if (!Number.isFinite(value)) return null;
			values.push(value);
		}
		i += count;
		return values;
	}

	while (i < tokens.length) {
		if (/^[a-zA-Z]$/.test(tokens[i])) {
			cmd = tokens[i];
			i += 1;
		} else if (!cmd) {
			i += 1;
			continue;
		}

		const upper = cmd.toUpperCase();
		const relative = cmd !== upper;

		switch (upper) {
			case "M":
			case "L": {
				const values = readNumbers(2);
				if (!values) return [];
				current = relative
					? { x: current.x + values[0], y: current.y + values[1] }
					: { x: values[0], y: values[1] };
				points.push(current);
				if (upper === "M") cmd = relative ? "l" : "L";
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
			case "Z":
				break;
			default:
				return [];
		}
	}

	return points;
}

function getPathBounds(d: string) {
	const points = getPathPoints(d);
	if (points.length === 0) return { x: 0, y: 0 };

	let minX = Infinity;
	let minY = Infinity;
	for (const point of points) {
		minX = Math.min(minX, point.x);
		minY = Math.min(minY, point.y);
	}

	return { x: minX, y: minY };
}

function getPathRenderTransform(element: PathElement): Point {
	const bounds = getPathBounds(element.d);
	const strokePad = Math.ceil(element.strokeWidth / 2);

	return {
		x: Math.round(element.x - bounds.x + strokePad),
		y: Math.round(element.y - bounds.y + strokePad)
	};
}

function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max);
}

function getImageRenderRect(element: ImageElement, asset: StoredImageAsset) {
	const frameWidth = Math.max(1, element.width);
	const frameHeight = Math.max(1, element.height);
	const baseScale = Math.max(frameWidth / Math.max(1, asset.width), frameHeight / Math.max(1, asset.height));
	const cropScale = Math.max(1, element.cropScale / 100);
	const width = Math.round(asset.width * baseScale * cropScale);
	const height = Math.round(asset.height * baseScale * cropScale);
	const overflowX = Math.max(0, width - frameWidth);
	const overflowY = Math.max(0, height - frameHeight);
	const baseX = element.x + (frameWidth - width) / 2;
	const baseY = element.y + (frameHeight - height) / 2;

	return {
		x: Math.round(baseX - (clamp(element.cropX, -100, 100) / 100) * (overflowX / 2)),
		y: Math.round(baseY - (clamp(element.cropY, -100, 100) / 100) * (overflowY / 2)),
		width,
		height
	};
}

const strJoin = (strings: string[], separator: string) => strings.join(separator);

function buildMetadata(project: Project, imageAssets: StoredImageAsset[]) {
	const projectFile = createProjectFilePackage(project, imageAssets);

	return {
		format: METADATA_FORMAT,
		version: METADATA_VERSION,
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

function renderText(element: TextElement, dx: number, dy: number, defs: string[]) {
	const layout = getTextLayout(element);
	const clipId = `text-clip-${element.id.replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
	const clipRect = [
		`<rect`,
		` x="${element.x + dx - layout.left}"`,
		` y="${element.y + dy - layout.ascent}"`,
		` width="${element.width}"`,
		` height="${element.height}" />`
	].join("");
	defs.push(`<clipPath id="${clipId}">${clipRect}</clipPath>`);

	const tspans = strJoin(
		layout.lines.map((line, i) => {
			const leading = i === 0 ? "0" : `${layout.lineHeight}px`;
			return [`<tspan`, ` x="${element.x + dx}"`, ` dy="${leading}">`, escapeXml(line || " "), `</tspan>`].join(
				""
			);
		}),
		""
	);

	return [
		`<text`,
		` id="${escapeXml(element.name)}"`,
		` x="${element.x + dx}"`,
		` y="${element.y + dy}"`,
		` font-size="${element.fontSize}"`,
		` font-family="${escapeXml(FONT_FAMILY)}"`,
		` fill="${escapeXml(element.fill)}"`,
		` xml:space="preserve"`,
		` clip-path="url(#${clipId})"`,
		` text-rendering="geometricPrecision">`,
		tspans,
		`</text>`
	].join("");
}

function renderImage(element: ImageElement, asset: StoredImageAsset | null, dx: number, dy: number) {
	const href = asset?.dataUrl ?? element.href ?? "";
	if (!href) {
		const pathX = element.x + dx + element.width / 2 - 18;
		const pathY = element.y + dy + element.height / 2 - 16;
		const frame = [
			`<rect`,
			` x="${element.x + dx}"`,
			` y="${element.y + dy}"`,
			` width="${element.width}"`,
			` height="${element.height}"`,
			` fill="${IMAGE_FILL}" />`
		].join("");
		const icon = [
			`<path`,
			` d="M0 0h18l5 6h13v18H0z"`,
			` fill="none"`,
			` stroke="${IMAGE_STROKE}"`,
			` stroke-width="1.5"`,
			` transform="translate(${pathX}, ${pathY})" />`
		].join("");
		const slash = [
			`<line`,
			` x1="${element.x + dx + 14}"`,
			` y1="${element.y + dy + element.height - 14}"`,
			` x2="${element.x + dx + element.width - 14}"`,
			` y2="${element.y + dy + 14}"`,
			` stroke="${IMAGE_STROKE}"`,
			` stroke-opacity="0.35"`,
			` stroke-width="2"`,
			` stroke-linecap="round" />`
		].join("");
		return [frame, icon, slash].join("");
	}

	if (!asset) {
		const group = [
			`<g id="${escapeXml(element.name)}">`,
			`<svg`,
			` x="${element.x + dx}"`,
			` y="${element.y + dy}"`,
			` width="${element.width}"`,
			` height="${element.height}"`,
			` viewBox="0 0 ${element.width} ${element.height}"`,
			` overflow="hidden">`,
			`<image`,
			` x="0"`,
			` y="0"`,
			` width="${element.width}"`,
			` height="${element.height}"`,
			` href="${escapeXml(href)}"`,
			` preserveAspectRatio="xMidYMid slice" />`,
			`</svg>`,
			`</g>`
		].join("");
		return group;
	}

	const rect = getImageRenderRect(element, asset);
	const localX = rect.x - element.x;
	const localY = rect.y - element.y;
	const mask = [
		`<rect`,
		` x="${element.x + dx}"`,
		` y="${element.y + dy}"`,
		` width="${element.width}"`,
		` height="${element.height}"`,
		` fill="${IMAGE_FILL}" />`
	].join("");

	const imageBlock = strJoin(
		[
			`<image`,
			` data-maply-asset-id="${escapeXml(asset.id)}"`,
			` x="${localX}"`,
			` y="${localY}"`,
			` width="${rect.width}"`,
			` height="${rect.height}"`,
			` href="${escapeXml(href)}"`,
			` preserveAspectRatio="none" />`
		],
		""
	);

	const innerSvg = [
		`<svg`,
		` x="${element.x + dx}"`,
		` y="${element.y + dy}"`,
		` width="${element.width}"`,
		` height="${element.height}"`,
		` viewBox="0 0 ${element.width} ${element.height}"`,
		` overflow="hidden">`,
		imageBlock,
		`</svg>`
	].join("");

	return [`<g id="${escapeXml(element.name)}">`, mask, innerSvg, `</g>`].join("");
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
				`<rect`,
				` id="${escapeXml(element.name)}"`,
				` x="${element.x + dx}"`,
				` y="${element.y + dy}"`,
				` width="${element.width}"`,
				` height="${element.height}"`,
				` fill="${escapeXml(element.fill)}"`,
				` stroke="${escapeXml(element.stroke)}"`,
				` stroke-width="${element.strokeWidth}" />`
			].join("");
		case "circle":
			return [
				`<circle`,
				` id="${escapeXml(element.name)}"`,
				` cx="${element.cx + dx}"`,
				` cy="${element.cy + dy}"`,
				` r="${element.r}"`,
				` fill="${escapeXml(element.fill)}"`,
				` stroke="${escapeXml(element.stroke)}"`,
				` stroke-width="${element.strokeWidth}" />`
			].join("");
		case "path": {
			const transform = getPathRenderTransform(element);
			return [
				`<path`,
				` id="${escapeXml(element.name)}"`,
				` transform="translate(${transform.x + dx}, ${transform.y + dy})"`,
				` d="${escapeXml(element.d)}"`,
				` fill="${escapeXml(element.fill)}"`,
				` stroke="${escapeXml(element.stroke)}"`,
				` stroke-width="${element.strokeWidth}" />`
			].join("");
		}
		case "text":
			return renderText(element, dx, dy, defs);
		case "image":
			return renderImage(element, element.assetId ? (assets.get(element.assetId) ?? null) : null, dx, dy);
	}
}

export function buildSvgExport(project: Project, imageAssets: StoredImageAsset[], options: SvgOptions = {}) {
	const defs: string[] = [];
	const assets = new Map(imageAssets.map((asset) => [asset.id, asset]));
	const metadata = JSON.stringify(buildMetadata(project, imageAssets));
	const dx = -project.canvas.x;
	const dy = -project.canvas.y;

	if (options.embeddedFontCss) {
		defs.push(`<style><![CDATA[${options.embeddedFontCss}]]></style>`);
	}

	const content = project.elements.map((element) => renderElement(element, assets, dx, dy, defs)).join("");
	const defsMarkup = defs.length > 0 ? `<defs>${defs.join("")}</defs>` : "";

	return [
		`<svg`,
		` xmlns="${SVG_XMLNS}"`,
		` width="${project.canvas.width}"`,
		` height="${project.canvas.height}"`,
		` viewBox="0 0 ${project.canvas.width} ${project.canvas.height}"`,
		` fill="none">`,
		`<metadata id="maply-recovery"><![CDATA[${escapeCdata(metadata)}]]></metadata>`,
		defsMarkup,
		`<rect x="0" y="0" width="${project.canvas.width}" height="${project.canvas.height}" fill="${escapeXml(project.canvas.color)}" />`,
		content,
		`</svg>`
	].join("");
}

export async function exportProjectSvg(project: Project, imageAssets: StoredImageAsset[]) {
	const embeddedFontCss = await loadEmbeddedInterFontCss();
	return buildSvgExport(project, imageAssets, { embeddedFontCss });
}
