import allScrollSvg from "$lib/assets/cursors/all-scroll.svg?raw";
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
import type { ResizeHandle } from "editor/types";

const CURSOR_SIZE = 24;

function sized(svg: string, size: number) {
	return svg.replace(/<svg\b([^>]*)>/, (_, attrs: string) => {
		const rest = attrs.replace(/\s(?:width|height)="[^"]*"/g, "");
		return `<svg width="${size}" height="${size}"${rest}>`;
	});
}

function dataUrl(svg: string, size: number) {
	return `url("data:image/svg+xml;utf8,${encodeURIComponent(sized(svg, size))}")`;
}

// Serve one oversized bitmap declared at 3x density: it still displays at
// CURSOR_SIZE CSS px, but the browser downscales a 60px raster instead of
// upscaling a 20px one, so it stays crisp at any device-pixel ratio
// (including fractional ones like 1.25x/1.5x, where discrete 1x/2x variants
// get upscaled). Hotspot coordinates stay in 1x/CSS pixels.
const OVERSAMPLE = 3;

function url(svg: string, hotspotX: number, hotspotY: number, fallback = "auto", size = CURSOR_SIZE) {
	const image = dataUrl(svg, size * OVERSAMPLE);
	return `-webkit-image-set(${image} ${OVERSAMPLE}x) ${hotspotX} ${hotspotY}, ${fallback}`;
}

export const canvasCursor = {
	default: url(cursorSvg, 5, 1),
	plus: url(cursorPlusSvg, 10, 10),
	pen: url(penNibSvg, 0, 0),
	text: url(cursorTextSvg, 10, 10),
	hand: url(handSvg, 10, 8, "grab"),
	grabbing: url(handGrabbingSvg, 10, 10, "grabbing"),
	allScroll: url(allScrollSvg, 10, 10, "all-scroll"),
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
