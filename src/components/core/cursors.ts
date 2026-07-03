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
import type { ResizeHandle } from "@app/types";

const CURSOR_SIZE = 20;

function sized(svg: string) {
	return svg.replace("<svg ", `<svg width="${CURSOR_SIZE}" height="${CURSOR_SIZE}" `);
}

function url(svg: string, hotspotX: number, hotspotY: number, fallback = "auto") {
	return `url("data:image/svg+xml;utf8,${encodeURIComponent(sized(svg))}") ${hotspotX} ${hotspotY}, ${fallback}`;
}

export const canvasCursor = {
	default: url(cursorSvg, 3, 3),
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
