import { createDefaultProject } from "../domain/defaults";
import type { CircleElement, Element, ImageElement, PathElement, RectElement, TextElement } from "../domain/elements";
import type { Point } from "../domain/geometry";
import type { StoredImageAsset } from "../domain/image-assets";
import { getElementBounds } from "./element-actions/geometry";
import { createElementId } from "./element-actions/naming";
import { getPathDataBounds, getPathPoints, pathDataFromPoints } from "./path-geometry";
import {
	parseProjectFilePackage,
	PROJECT_FILE_FORMAT,
	PROJECT_FILE_VERSION,
	type ProjectFilePackage
} from "./project-file";

const SVG_RECOVERY_FORMAT = "maply-svg-recovery";
const SVG_RECOVERY_VERSION = 1;
const RECOVERY_METADATA_ID = "maply-recovery";
const SYNOPTIC_SVG_CLASS = "gen-by-synoptic-designer";
const SYNOPTIC_SHAPE_FILL = "#000000";

function logSvgImport(message: string, details?: unknown) {
	if (details === undefined) {
		console.info(`[svg-import] ${message}`);
		return;
	}

	console.info(`[svg-import] ${message}`, details);
}

type SvgImportMetadata = {
	format: typeof SVG_RECOVERY_FORMAT;
	version: typeof SVG_RECOVERY_VERSION;
	projectId: string;
	project: unknown;
	imageAssets: Array<{
		id: string;
		name: string;
		mimeType: string;
		width: number;
		height: number;
	}>;
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, message: string): string {
	if (typeof value !== "string") throw new Error(message);
	return value;
}

function requireNumber(value: unknown, message: string): number {
	if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(message);
	return value;
}

function requireArray(value: unknown, message: string): unknown[] {
	if (!Array.isArray(value)) throw new Error(message);
	return value;
}

function decodeXml(value: string) {
	return value
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&amp;/g, "&");
}

function extractRecoveryMetadata(svg: string): string {
	const match = svg.match(
		new RegExp(
			`<metadata\\b[^>]*\\bid\\s*=\\s*(["'])${RECOVERY_METADATA_ID}\\1[^>]*>([\\s\\S]*?)<\\/metadata>`,
			"i"
		)
	);
	if (!match) {
		throw new Error("SVG does not contain Maply recovery metadata.");
	}

	const raw = match[2]?.trim() ?? "";
	const cdata = raw.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
	return (cdata ? cdata[1] : decodeXml(raw)).replace(/]]<!\[CDATA\[/g, "]]>");
}

function parseMetadata(svg: string): SvgImportMetadata {
	const metadataText = extractRecoveryMetadata(svg);
	let parsed: unknown;

	try {
		parsed = JSON.parse(metadataText);
	} catch {
		throw new Error("SVG recovery metadata is not valid JSON.");
	}

	if (!isRecord(parsed)) throw new Error("SVG recovery metadata root must be an object.");
	if (parsed.format !== SVG_RECOVERY_FORMAT) {
		throw new Error("Unsupported SVG recovery format.");
	}
	if (parsed.version !== SVG_RECOVERY_VERSION) {
		throw new Error(`Unsupported SVG recovery version: ${String(parsed.version)}.`);
	}

	return {
		format: SVG_RECOVERY_FORMAT,
		version: SVG_RECOVERY_VERSION,
		projectId: isRecord(parsed.project)
			? requireString(parsed.project.id, "SVG recovery project id must be a string.")
			: (() => {
					throw new Error("SVG recovery project payload must be an object.");
				})(),
		project: parsed.project,
		imageAssets: requireArray(parsed.imageAssets, "SVG recovery imageAssets must be an array.").map((value) => {
			if (!isRecord(value)) throw new Error("SVG recovery image asset entries must be objects.");
			return {
				id: requireString(value.id, "SVG recovery image asset id must be a string."),
				name: requireString(value.name, "SVG recovery image asset name must be a string."),
				mimeType: requireString(value.mimeType, "SVG recovery image asset mimeType must be a string."),
				width: requireNumber(value.width, "SVG recovery image asset width must be a number."),
				height: requireNumber(value.height, "SVG recovery image asset height must be a number.")
			};
		})
	};
}

function parseAttributes(tag: string) {
	const attrs = new Map<string, string>();
	const attrPattern = /([:\w-]+)\s*=\s*(["'])([\s\S]*?)\2/g;

	for (const match of tag.matchAll(attrPattern)) {
		attrs.set(match[1], decodeXml(match[3]));
	}

	return attrs;
}

function readFiniteNumber(attrs: Map<string, string>, key: string) {
	const raw = attrs.get(key);
	if (!raw) return null;
	const value = Number(raw);
	return Number.isFinite(value) ? value : null;
}

function readViewBox(attrs: Map<string, string>) {
	const raw = attrs.get("viewBox");
	if (!raw) return null;
	const parts = raw
		.trim()
		.split(/[\s,]+/)
		.map((part) => Number(part));
	if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) return null;
	return { minX: parts[0], minY: parts[1], width: parts[2], height: parts[3] };
}

function readOptionalText(svg: string, tagName: string) {
	const match = svg.match(new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"));
	return match?.[1] ?? null;
}

function stripMarkup(value: string) {
	return decodeXml(value.replace(/<[^>]+>/g, "")).trim();
}

function shapeName(attrs: Map<string, string>, fallback: string) {
	return attrs.get("id")?.trim() || fallback;
}

function parsePoints(raw: string, offset: { x: number; y: number }): Point[] {
	const values = raw
		.trim()
		.split(/[\s,]+/)
		.filter(Boolean)
		.map((part) => Number(part));
	if (values.length < 6 || values.length % 2 !== 0 || values.some((value) => !Number.isFinite(value))) {
		throw new Error("Synoptic SVG polygon points must be numeric coordinate pairs.");
	}

	const points: Point[] = [];
	for (let index = 0; index < values.length; index += 2) {
		points.push({ x: values[index] - offset.x, y: values[index + 1] - offset.y });
	}
	return points;
}

function parseImageElement(
	svg: string,
	offset: { x: number; y: number }
): { element: ImageElement; asset: StoredImageAsset } | null {
	const imageTag = svg.match(/<image\b[^>]*>/i)?.[0];
	if (!imageTag) return null;

	const attrs = parseAttributes(imageTag);
	const href = attrs.get("href") ?? attrs.get("xlink:href");
	if (!href?.startsWith("data:")) {
		throw new Error("Synoptic SVG background image must be embedded as a data URL.");
	}

	const width = readFiniteNumber(attrs, "width");
	const height = readFiniteNumber(attrs, "height");
	if (width === null || height === null) {
		throw new Error("Synoptic SVG background image must declare numeric width and height.");
	}

	const x = readFiniteNumber(attrs, "x") ?? 0;
	const y = readFiniteNumber(attrs, "y") ?? 0;
	const id = attrs.get("id") ?? createElementId();
	const assetId = `asset-${id}`;

	return {
		element: {
			id,
			name: "floorplan",
			type: "image",
			x: Math.round(x - offset.x),
			y: Math.round(y - offset.y),
			width: Math.round(width),
			height: Math.round(height),
			assetId,
			cropX: 0,
			cropY: 0,
			cropScale: 100
		},
		asset: {
			id: assetId,
			projectId: "prod",
			name: "floorplan.png",
			mimeType: href.slice(5, href.indexOf(";") > -1 ? href.indexOf(";") : href.indexOf(",")),
			dataUrl: href,
			width: Math.round(width),
			height: Math.round(height)
		}
	};
}

function parsePolygonElements(svg: string, offset: { x: number; y: number }): PathElement[] {
	const elements: PathElement[] = [];
	const polygonTagPattern = /<polygon\b[^>]*>/gi;

	for (const match of svg.matchAll(polygonTagPattern)) {
		const attrs = parseAttributes(match[0]);
		const pointsAttr = attrs.get("points");
		if (!pointsAttr) continue;
		let points: Point[];
		try {
			points = parsePoints(pointsAttr, offset);
		} catch (error) {
			console.warn("[svg-import] skipping polygon with invalid points", {
				error,
				tag: match[0],
				id: attrs.get("id") ?? null,
				points: pointsAttr
			});
			continue;
		}
		elements.push({
			id: attrs.get("id") ?? createElementId(),
			name: shapeName(attrs, "polygon"),
			type: "path",
			x: Math.round(Math.min(...points.map((point) => point.x))),
			y: Math.round(Math.min(...points.map((point) => point.y))),
			d: pathDataFromPoints(points, true),
			fill: SYNOPTIC_SHAPE_FILL,
			stroke: "none",
			strokeWidth: 0,
			closed: true
		});
	}

	return elements;
}

function parseRectElements(svg: string, offset: { x: number; y: number }): RectElement[] {
	const elements: RectElement[] = [];
	const rectTagPattern = /<rect\b[^>]*>/gi;

	for (const match of svg.matchAll(rectTagPattern)) {
		const attrs = parseAttributes(match[0]);
		const width = readFiniteNumber(attrs, "width");
		const height = readFiniteNumber(attrs, "height");
		if (width === null || height === null) continue;
		elements.push({
			id: attrs.get("id") ?? createElementId(),
			name: shapeName(attrs, "rect"),
			type: "rect",
			x: Math.round((readFiniteNumber(attrs, "x") ?? 0) - offset.x),
			y: Math.round((readFiniteNumber(attrs, "y") ?? 0) - offset.y),
			width: Math.round(width),
			height: Math.round(height),
			fill: SYNOPTIC_SHAPE_FILL,
			stroke: "none",
			strokeWidth: 0
		});
	}

	return elements;
}

function parseCircleElements(svg: string, offset: { x: number; y: number }): CircleElement[] {
	const elements: CircleElement[] = [];
	const circleTagPattern = /<circle\b[^>]*>/gi;

	for (const match of svg.matchAll(circleTagPattern)) {
		const attrs = parseAttributes(match[0]);
		const cx = readFiniteNumber(attrs, "cx");
		const cy = readFiniteNumber(attrs, "cy");
		const r = readFiniteNumber(attrs, "r");
		if (cx === null || cy === null || r === null) continue;
		elements.push({
			id: attrs.get("id") ?? createElementId(),
			name: shapeName(attrs, "circle"),
			type: "circle",
			cx: Math.round(cx - offset.x),
			cy: Math.round(cy - offset.y),
			r: Math.round(r),
			fill: SYNOPTIC_SHAPE_FILL,
			stroke: "none",
			strokeWidth: 0
		});
	}

	return elements;
}

function parsePathElements(svg: string, offset: { x: number; y: number }): PathElement[] {
	const elements: PathElement[] = [];
	const pathTagPattern = /<path\b[^>]*>/gi;

	for (const match of svg.matchAll(pathTagPattern)) {
		const attrs = parseAttributes(match[0]);
		const d = attrs.get("d")?.trim();
		if (!d) continue;
		const points = getPathPoints(d);
		const bounds = getPathDataBounds(points);
		const translated =
			points.length === 0
				? d
				: pathDataFromPoints(
						points.map((point) => ({ x: point.x - offset.x, y: point.y - offset.y })),
						/\s*[Zz]\s*$/.test(d)
					);
		elements.push({
			id: attrs.get("id") ?? createElementId(),
			name: shapeName(attrs, "path"),
			type: "path",
			x: Math.round(bounds.x - offset.x),
			y: Math.round(bounds.y - offset.y),
			d: translated,
			fill: SYNOPTIC_SHAPE_FILL,
			stroke: "none",
			strokeWidth: 0,
			closed: /\s*[Zz]\s*$/.test(d)
		});
	}

	return elements;
}

function parseTextElements(svg: string, offset: { x: number; y: number }): TextElement[] {
	const elements: TextElement[] = [];
	const textTagPattern = /<text\b[^>]*>[\s\S]*?<\/text>/gi;

	for (const match of svg.matchAll(textTagPattern)) {
		const tag = match[0];
		const openTag = tag.match(/<text\b[^>]*>/i)?.[0];
		if (!openTag) continue;
		const attrs = parseAttributes(openTag);
		const text = stripMarkup(readOptionalText(tag, "text") ?? "");
		if (!text) continue;
		elements.push({
			id: attrs.get("id") ?? createElementId(),
			name: shapeName(attrs, "text"),
			type: "text",
			x: Math.round((readFiniteNumber(attrs, "x") ?? 0) - offset.x),
			y: Math.round((readFiniteNumber(attrs, "y") ?? 0) - offset.y),
			width: 0,
			height: 0,
			text,
			fontSize: Math.max(1, Math.round(readFiniteNumber(attrs, "font-size") ?? 24)),
			fill: SYNOPTIC_SHAPE_FILL
		});
	}

	return elements;
}

function translateElement(element: Element, dx: number, dy: number): Element {
	switch (element.type) {
		case "rect":
		case "image":
		case "text":
		case "path":
			return { ...element, x: element.x + dx, y: element.y + dy };
		case "circle":
			return { ...element, cx: element.cx + dx, cy: element.cy + dy };
	}
}

function fitProjectCanvasToElements(
	project: ProjectFilePackage["project"],
	fallback: { width: number; height: number }
) {
	if (project.elements.length === 0) {
		project.canvas.width = Math.max(1, Math.round(fallback.width));
		project.canvas.height = Math.max(1, Math.round(fallback.height));
		project.canvas.x = 0;
		project.canvas.y = 0;
		return;
	}

	const bounds = project.elements.map((element) => getElementBounds(element));
	const minX = Math.min(...bounds.map((bound) => bound.x));
	const minY = Math.min(...bounds.map((bound) => bound.y));
	const maxX = Math.max(...bounds.map((bound) => bound.x + bound.width));
	const maxY = Math.max(...bounds.map((bound) => bound.y + bound.height));

	project.elements = project.elements.map((element) => translateElement(element, -minX, -minY));
	project.canvas.width = Math.max(1, Math.round(maxX - minX));
	project.canvas.height = Math.max(1, Math.round(maxY - minY));
	project.canvas.x = 0;
	project.canvas.y = 0;
}

function filterElementsInsideCanvas(elements: Element[], canvas: { width: number; height: number }) {
	return elements.filter((element) => {
		const bounds = getElementBounds(element);
		return (
			bounds.x >= 0 &&
			bounds.y >= 0 &&
			bounds.x + bounds.width <= canvas.width &&
			bounds.y + bounds.height <= canvas.height
		);
	});
}

function nextUniqueElementId(usedIds: Set<string>) {
	let id = createElementId();
	while (usedIds.has(id)) {
		id = createElementId();
	}
	usedIds.add(id);
	return id;
}

function dedupeElementIds(elements: Element[], imageAssets: StoredImageAsset[]) {
	const usedIds = new Set<string>();
	const assetsById = new Map(imageAssets.map((asset) => [asset.id, asset]));
	let deduped = 0;

	const next = elements.map((element) => {
		if (!usedIds.has(element.id)) {
			usedIds.add(element.id);
			return element;
		}

		deduped += 1;
		const id = nextUniqueElementId(usedIds);
		if (element.type !== "image") return { ...element, id };

		const asset = element.assetId ? assetsById.get(element.assetId) : null;
		if (!asset) return { ...element, id };

		const assetId = `asset-${id}`;
		assetsById.delete(asset.id);
		asset.id = assetId;
		assetsById.set(assetId, asset);
		return { ...element, id, assetId };
	});

	if (deduped > 0) {
		logSvgImport("deduplicated repeated element ids", { deduped });
	}

	return next;
}

function parseSynopticSvgProjectFilePackage(svg: string): ProjectFilePackage | null {
	const rootTag = svg.match(/<svg\b[^>]*>/i)?.[0];
	if (!rootTag) {
		throw new Error("SVG must contain a root <svg> element.");
	}

	const attrs = parseAttributes(rootTag);
	if (!attrs.get("class")?.split(/\s+/).includes(SYNOPTIC_SVG_CLASS)) {
		return null;
	}

	const viewBox = readViewBox(attrs);
	const declaredWidth = readFiniteNumber(attrs, "width");
	const declaredHeight = readFiniteNumber(attrs, "height");
	const hasDeclaredCanvas = viewBox !== null || (declaredWidth !== null && declaredHeight !== null);
	const width = viewBox?.width ?? declaredWidth ?? 1;
	const height = viewBox?.height ?? declaredHeight ?? 1;
	logSvgImport("using fallback synoptic importer", {
		hasDeclaredCanvas,
		viewBox,
		declaredWidth,
		declaredHeight,
		width,
		height
	});

	const offset = {
		x: viewBox?.minX ?? 0,
		y: viewBox?.minY ?? 0
	};
	const project = createDefaultProject("prod");
	project.canvas.width = Math.max(1, Math.round(width));
	project.canvas.height = Math.max(1, Math.round(height));
	project.canvas.x = 0;
	project.canvas.y = 0;
	project.name = attrs.get("id")?.trim() || "Imported SVG";

	const background = parseImageElement(svg, offset);
	const shapeElements: Element[] = [
		...parseRectElements(svg, offset),
		...parseCircleElements(svg, offset),
		...parsePathElements(svg, offset),
		...parsePolygonElements(svg, offset),
		...parseTextElements(svg, offset)
	];
	const elements: Element[] = [];
	const imageAssets: StoredImageAsset[] = [];

	if (background) {
		elements.push(background.element);
		imageAssets.push(background.asset);
	}

	elements.push(...shapeElements);
	const filtered = hasDeclaredCanvas ? filterElementsInsideCanvas(elements, project.canvas) : elements;
	const dropped = elements.length - filtered.length;
	if (dropped > 0) {
		logSvgImport("dropped elements outside declared canvas", {
			dropped,
			kept: filtered.length,
			canvas: { width: project.canvas.width, height: project.canvas.height }
		});
	}
	logSvgImport("parsed fallback svg elements", {
		background: background ? 1 : 0,
		shapes: shapeElements.length,
		total: elements.length,
		kept: filtered.length
	});
	project.elements = dedupeElementIds(filtered, imageAssets);

	const parsed = parseProjectFilePackage(
		JSON.stringify({
			format: PROJECT_FILE_FORMAT,
			version: PROJECT_FILE_VERSION,
			project,
			imageAssets
		})
	);
	if (!hasDeclaredCanvas) {
		logSvgImport("fitting canvas to imported content bounds", { fallbackWidth: width, fallbackHeight: height });
		fitProjectCanvasToElements(parsed.project, { width, height });
	}
	logSvgImport("fallback import complete", {
		elements: parsed.project.elements.length,
		imageAssets: parsed.imageAssets.length,
		canvas: parsed.project.canvas
	});
	return parseProjectFilePackage(JSON.stringify(parsed));
}

function extractAssetDataUrls(svg: string) {
	const dataUrls = new Map<string, string>();
	const imageTagPattern = /<image\b[^>]*\/?>(?:<\/image>)?/gi;

	for (const match of svg.matchAll(imageTagPattern)) {
		const attrs = parseAttributes(match[0]);
		const assetId = attrs.get("data-maply-asset-id");
		const href = attrs.get("href") ?? attrs.get("xlink:href");
		if (!assetId || !href) continue;
		if (!href.startsWith("data:")) {
			throw new Error(`SVG recovery asset ${assetId} is not embedded as a data URL.`);
		}

		const previous = dataUrls.get(assetId);
		if (previous && previous !== href) {
			throw new Error(`SVG recovery asset ${assetId} has conflicting embedded data.`);
		}

		dataUrls.set(assetId, href);
	}

	return dataUrls;
}

function buildImageAssets(metadata: SvgImportMetadata, assetDataUrls: Map<string, string>): StoredImageAsset[] {
	return metadata.imageAssets.map((asset) => {
		const dataUrl = assetDataUrls.get(asset.id);
		if (!dataUrl) {
			throw new Error(`SVG recovery data is missing embedded image asset ${asset.id}.`);
		}

		return {
			...asset,
			projectId: metadata.projectId,
			dataUrl
		};
	});
}

export function parseSvgProjectFilePackage(svg: string): ProjectFilePackage {
	logSvgImport("starting svg parse", { length: svg.length });
	try {
		const metadata = parseMetadata(svg);
		logSvgImport("detected Maply recovery metadata", {
			projectId: metadata.projectId,
			imageAssets: metadata.imageAssets.length
		});
		const imageAssets = buildImageAssets(metadata, extractAssetDataUrls(svg));
		const parsed = parseProjectFilePackage(
			JSON.stringify({
				format: PROJECT_FILE_FORMAT,
				version: PROJECT_FILE_VERSION,
				project: metadata.project,
				imageAssets
			})
		);
		logSvgImport("Maply recovery import complete", {
			elements: parsed.project.elements.length,
			imageAssets: parsed.imageAssets.length,
			canvas: parsed.project.canvas
		});
		return parsed;
	} catch (error) {
		if (error instanceof Error && /Maply recovery metadata/i.test(error.message)) {
			logSvgImport("Maply metadata not found, trying fallback importer", { error: error.message });
			const synoptic = parseSynopticSvgProjectFilePackage(svg);
			if (synoptic) return synoptic;
		}
		console.error("[svg-import] parse failed", error);
		throw error;
	}
}
