import arrowHorSvg from "$lib/assets/cursors/arrow-hor.svg?raw";
import arrowOut1Svg from "$lib/assets/cursors/arrow-out-1.svg?raw";
import arrowOut2Svg from "$lib/assets/cursors/arrow-out-2.svg?raw";
import arrowVertSvg from "$lib/assets/cursors/arrow-vert.svg?raw";
import cursorPlusSvg from "$lib/assets/cursors/cursor-plus.svg?raw";
import cursorTextSvg from "$lib/assets/cursors/cursor-text.svg?raw";
import cursorSvg from "$lib/assets/cursors/cursor.svg?raw";
import handGrabbingSvg from "$lib/assets/cursors/hand-grabbing.svg?raw";
import handSvg from "$lib/assets/cursors/hand.svg?raw";
import penNibSvg from "$lib/assets/cursors/pen-nib.svg?raw";
import type { ResizeHandle } from "editor";

const CURSOR_SIZE = 20;

// Base stroke width used by all cursor SVGs (in the 256 viewBox).
const STROKE_WIDTH = 16;
// Extra width for the white halo behind the cursor, so it stays visible on
// dark/low-contrast backgrounds anywhere on the canvas. Widths are in viewBox
// units: the 256 viewBox renders at 20px, so each viewBox unit is ~0.08px —
// +36 gives roughly a 1.4px halo on each side of the stroke.
const HALO_STROKE_WIDTH = STROKE_WIDTH + 40;
// Shadow is a slightly wider, offset dark copy behind the halo. We keep it as a
// plain vector stroke (no SVG filter) so the cursor rasterizes crisply.
const SHADOW_STROKE_WIDTH = HALO_STROKE_WIDTH + 10;

// Recolor/rewidth the cloned inner markup into a single-color layer. When
// `fill` is set, shapes are filled so the layer is a solid silhouette rather
// than an outline.
function layer(inner: string, color: string, width: number, opacity = 1, fill = false) {
	const paths = inner
		.replaceAll('stroke="currentColor"', `stroke="${color}"`)
		.replaceAll('fill="none"', fill ? `fill="${color}"` : 'fill="none"')
		.replaceAll(`stroke-width="${STROKE_WIDTH}"`, `stroke-width="${width}"`);
	return `<g opacity="${opacity}">${paths}</g>`;
}

// Stack, bottom to top: a soft dark shadow, a white halo, then the cursor. The
// halo keeps the cursor visible on dark backgrounds; the shadow adds depth.
// `filled` renders the top layer as a solid black shape (used for the default
// arrow); the halo/shadow are always solid silhouettes.
function haloed(svg: string, filled: boolean) {
	const open = svg.indexOf(">") + 1;
	const close = svg.lastIndexOf("</svg>");
	// Drop the full-viewBox placeholder rect so fills apply only to the shapes.
	const inner = svg.slice(open, close).replace(/<rect width="256" height="256"[^>]*\/>/, "");
	const shadow = `<g transform="translate(0,10)">${layer(inner, "#000", SHADOW_STROKE_WIDTH, 0.25, true)}</g>`;
	const halo = layer(inner, "#fff", HALO_STROKE_WIDTH, 1, true);
	const cursor = layer(inner, "#000", STROKE_WIDTH, 1, filled);
	return svg.slice(0, open) + shadow + halo + cursor + svg.slice(close);
}

function sized(svg: string, size: number, filled: boolean) {
	return haloed(svg, filled).replace("<svg ", `<svg width="${size}" height="${size}" `);
}

function dataUrl(svg: string, size: number, filled: boolean) {
	return `url("data:image/svg+xml;utf8,${encodeURIComponent(sized(svg, size, filled))}")`;
}

// Serve one oversized bitmap declared at 3x density: it still displays at
// CURSOR_SIZE CSS px, but the browser downscales a 60px raster instead of
// upscaling a 20px one, so it stays crisp at any device-pixel ratio
// (including fractional ones like 1.25x/1.5x, where discrete 1x/2x variants
// get upscaled). Hotspot coordinates stay in 1x/CSS pixels.
const OVERSAMPLE = 3;

function url(svg: string, hotspotX: number, hotspotY: number, fallback = "auto", filled = false, size = CURSOR_SIZE) {
	const image = dataUrl(svg, size * OVERSAMPLE, filled);
	return `-webkit-image-set(${image} ${OVERSAMPLE}x) ${hotspotX} ${hotspotY}, ${fallback}`;
}

export const canvasCursor = {
	// The filled arrow reads visually heavier than the outline cursors, so it
	// renders slightly smaller.
	default: url(cursorSvg, 3, 3, "auto", true, 17),
	plus: url(cursorPlusSvg, 10, 10),
	pen: url(penNibSvg, 0, 0),
	text: url(cursorTextSvg, 10, 10),
	hand: url(handSvg, 8, 5, "grab"),
	grabbing: url(handGrabbingSvg, 8, 9, "grabbing"),
	resizeHorizontal: url(arrowHorSvg, 10, 10, "ew-resize"),
	resizeVertical: url(arrowVertSvg, 10, 10, "ns-resize"),
	resizeDiagonalDown: url(arrowOut1Svg, 10, 10, "nwse-resize"),
	resizeDiagonalUp: url(arrowOut2Svg, 10, 10, "nesw-resize")
} as const;

export function resizeCursor(handle: ResizeHandle) {
	if (handle === "e" || handle === "w") return canvasCursor.resizeHorizontal;
	if (handle === "n" || handle === "s") return canvasCursor.resizeVertical;
	if (handle === "nw" || handle === "se") return canvasCursor.resizeDiagonalDown;
	return canvasCursor.resizeDiagonalUp;
}
