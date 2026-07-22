import { createDefaultProject } from "@maply/model";
import type { Element, Project, StoredImageAsset } from "@maply/model/types";
import { Effect } from "effect";

import { SvgEmptyDocumentError, SvgImageDecodeError, SvgParseError } from "../errors";
import { SvgImportWarningType, type SvgImportWarning } from "../types";
import { attributes, bounds, fitCanvas, id, name, number, pathData, pathPoints, viewBox } from "./common";

const SYNOPTIC_CLASS = "gen-by-synoptic-designer";
const SHAPE_FILL = "#000000";

type Offset = { x: number; y: number };
type DraftProject = { -readonly [Key in keyof Project]: Project[Key] };

/**
 * Parses an SVG into a Maply project.
 * Returns null if requireSynopticMarker is true and the SVG doesn't carry the Synoptic class marker.
 * Coordinates are shifted by the viewBox origin so all elements sit in a zero-based canvas.
 */
function parseShapes(svg: string, requireSynopticMarker: boolean) {
	return Effect.gen(function* () {
		const root = svg.match(/<svg\b[^>]*>/i)?.[0];
		if (!root) return yield* Effect.fail(new SvgParseError({ message: "SVG must contain a root <svg> element." }));

		const rootAttrs = attributes(root);
		if (requireSynopticMarker && !rootAttrs.get("class")?.split(/\s+/).includes(SYNOPTIC_CLASS)) return null;

		/*
		 * Canvas dimensions come from viewBox if present, otherwise from explicit width/height.
		 * When neither exists (hasCanvas = false), we auto-fit the canvas to element bounds later.
		 */
		const box = viewBox(rootAttrs);
		const declaredWidth = number(rootAttrs, "width");
		const declaredHeight = number(rootAttrs, "height");
		const hasCanvas = box !== null || (declaredWidth !== null && declaredHeight !== null);
		const offset: Offset = { x: box?.minX ?? 0, y: box?.minY ?? 0 };

		const project: DraftProject = { ...createDefaultProject("prod") };
		project.name = rootAttrs.get("id")?.trim() || "Imported SVG";
		project.canvas = {
			...project.canvas,
			width: Math.max(1, Math.round(box?.width ?? declaredWidth ?? 1)),
			height: Math.max(1, Math.round(box?.height ?? declaredHeight ?? 1)),
			x: 0,
			y: 0
		};

		const elements: Element[] = [];
		const imageAssets: StoredImageAsset[] = [];
		const warnings: SvgImportWarning[] = [];

		/*
		 * Synoptic SVGs embed at most one <image> as the floorplan background.
		 * The image data must be a base64 data URL — external hrefs are rejected
		 * because we need the asset to be self-contained for offline use.
		 */
		const image = svg.match(/<image\b[^>]*>/i)?.[0];
		if (image) {
			const attrs = attributes(image);
			const href = attrs.get("href") ?? attrs.get("xlink:href");
			const width = number(attrs, "width");
			const height = number(attrs, "height");

			if (!href?.startsWith("data:"))
				return yield* Effect.fail(
					new SvgImageDecodeError({ message: "SVG background image must be embedded as a data URL." })
				);
			if (width === null || height === null)
				return yield* Effect.fail(
					new SvgImageDecodeError({ message: "SVG background image must declare numeric width and height." })
				);

			const elementId = id();
			const assetId = `asset-${elementId}`;

			elements.push({
				id: elementId,
				name: name(attrs, "image"),
				type: "image",
				locked: false,
				visible: true,
				bindable: false,
				x: Math.round((number(attrs, "x") ?? 0) - offset.x),
				y: Math.round((number(attrs, "y") ?? 0) - offset.y),
				width: Math.round(width),
				height: Math.round(height),
				assetId,
				cropX: 0,
				cropY: 0,
				cropScale: 100
			});

			imageAssets.push({
				id: assetId,
				projectId: "prod",
				name: "floorplan.png",
				mimeType: href.slice(5, href.indexOf(";") > -1 ? href.indexOf(";") : href.indexOf(",")),
				dataUrl: href,
				width: Math.round(width),
				height: Math.round(height)
			});
		}

		/* --- Shape element extraction (rect, circle, path, polygon, text) ---
		 * Each block regex-matches its SVG element type, reads attributes,
		 * applies the viewBox offset, and pushes a Maply Element.
		 * Elements missing required attributes (e.g. rect without width) are silently skipped.
		 */

		for (const match of svg.matchAll(/<rect\b[^>]*>/gi)) {
			const attrs = attributes(match[0]);
			const width = number(attrs, "width");
			const height = number(attrs, "height");

			if (width !== null && height !== null)
				elements.push({
					id: id(),
					name: name(attrs, "rect"),
					type: "rect",
					locked: false,
					visible: true,
					bindable: true,
					x: Math.round((number(attrs, "x") ?? 0) - offset.x),
					y: Math.round((number(attrs, "y") ?? 0) - offset.y),
					width: Math.round(width),
					height: Math.round(height),
					fill: SHAPE_FILL,
					stroke: "none",
					strokeWidth: 0
				});
		}

		for (const match of svg.matchAll(/<circle\b[^>]*>/gi)) {
			const attrs = attributes(match[0]);
			const cx = number(attrs, "cx");
			const cy = number(attrs, "cy");
			const r = number(attrs, "r");

			if (cx !== null && cy !== null && r !== null)
				elements.push({
					id: id(),
					name: name(attrs, "circle"),
					type: "circle",
					locked: false,
					visible: true,
					bindable: true,
					cx: Math.round(cx - offset.x),
					cy: Math.round(cy - offset.y),
					r: Math.round(r),
					fill: SHAPE_FILL,
					stroke: "none",
					strokeWidth: 0
				});
		}

		/*
		 * Paths only support M/L/H/V commands (move and line-to variants).
		 * Curves (C/S/Q/T/A) are not handled — pathPoints returns [] for those,
		 * so we fall back to keeping the raw `d` string untranslated.
		 */
		for (const match of svg.matchAll(/<path\b[^>]*>/gi)) {
			const attrs = attributes(match[0]);
			const d = attrs.get("d")?.trim();
			if (!d) continue;

			const points = pathPoints(d);
			const closed = /\s*[Zz]\s*$/.test(d);

			const translated =
				points.length === 0
					? d
					: pathData(
							points.map((point) => ({ x: point.x - offset.x, y: point.y - offset.y })),
							closed
						);

			const xs = points.map((point) => point.x);
			const ys = points.map((point) => point.y);

			elements.push({
				id: id(),
				name: name(attrs, "path"),
				type: "path",
				locked: false,
				visible: true,
				bindable: true,
				x: Math.round((points.length ? Math.min(...xs) : 0) - offset.x),
				y: Math.round((points.length ? Math.min(...ys) : 0) - offset.y),
				d: translated,
				fill: SHAPE_FILL,
				stroke: "none",
				strokeWidth: 0,
				closed
			});
		}

		/* Polygons are converted to closed paths. Requires at least 3 coordinate pairs. */
		for (const match of svg.matchAll(/<polygon\b[^>]*>/gi)) {
			const attrs = attributes(match[0]);
			const raw = attrs.get("points");
			if (!raw) continue;

			const values = raw
				.trim()
				.split(/[\s,]+/)
				.filter(Boolean)
				.map(Number);

			if (values.length < 6 || values.length % 2 || values.some((value) => !Number.isFinite(value))) {
				warnings.push({
					type: SvgImportWarningType.InvalidPolygon,
					message: "Skipped polygon with invalid points.",
					source: { tag: "polygon", elementId: attrs.get("id"), attribute: "points" }
				});
				continue;
			}

			const points = Array.from({ length: values.length / 2 }, (_, index) => ({
				x: values[index * 2] - offset.x,
				y: values[index * 2 + 1] - offset.y
			}));

			elements.push({
				id: id(),
				name: name(attrs, "polygon"),
				type: "path",
				locked: false,
				visible: true,
				bindable: true,
				x: Math.round(Math.min(...points.map((point) => point.x))),
				y: Math.round(Math.min(...points.map((point) => point.y))),
				d: pathData(points, true),
				fill: SHAPE_FILL,
				stroke: "none",
				strokeWidth: 0,
				closed: true
			});
		}

		/* Text content is extracted by stripping all inner tags (e.g. <tspan>). */
		for (const match of svg.matchAll(/<text\b[^>]*>[\s\S]*?<\/text>/gi)) {
			const tag = match[0];
			const open = tag.match(/<text\b[^>]*>/i)?.[0];
			if (!open) continue;

			const attrs = attributes(open);
			const text = tag
				.replace(/^<text\b[^>]*>|<\/text>$/gi, "")
				.replace(/<[^>]+>/g, "")
				.trim();

			if (text)
				elements.push({
					id: id(),
					name: name(attrs, "text"),
					type: "text",
					locked: false,
					visible: true,
					bindable: false,
					x: Math.round((number(attrs, "x") ?? 0) - offset.x),
					y: Math.round((number(attrs, "y") ?? 0) - offset.y),
					width: 0,
					height: 0,
					text,
					fontSize: Math.max(1, Math.round(number(attrs, "font-size") ?? 24)),
					fill: SHAPE_FILL
				});
		}

		/*
		 * When an explicit canvas exists, drop elements that fall entirely outside it —
		 * Synoptic files sometimes include off-canvas decorations or tooling artifacts.
		 * Without a declared canvas, keep everything and auto-fit the canvas to the content.
		 */
		const kept = hasCanvas
			? elements.filter((element) => {
					const item = bounds(element);
					return (
						item.x >= 0 &&
						item.y >= 0 &&
						item.x + item.width <= project.canvas.width &&
						item.y + item.height <= project.canvas.height
					);
				})
			: elements;

		if (kept.length !== elements.length)
			warnings.push({
				type: SvgImportWarningType.DroppedOutsideCanvas,
				message: "Dropped SVG elements outside the declared canvas."
			});

		project.elements = kept;

		if (!project.elements.length)
			return yield* Effect.fail(new SvgEmptyDocumentError({ message: "SVG contains no importable elements." }));

		if (!hasCanvas) fitCanvas(project, { width: project.canvas.width, height: project.canvas.height });

		return { project, imageAssets, warnings };
	});
}

export function parseGeneric(svg: string) {
	return parseShapes(svg, false).pipe(
		Effect.flatMap((result) =>
			result !== null
				? Effect.succeed(result)
				: Effect.fail(new SvgParseError({ message: "SVG must contain a root <svg> element." }))
		)
	);
}

export function importSynoptic(svg: string) {
	return parseShapes(svg, true);
}
