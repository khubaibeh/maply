import type { Point } from "@maply/model/types";

/** Returns the nearest SVG viewport containing an event target. */
export function getSvgRoot(target: EventTarget | null): SVGSVGElement | null {
	if (!(target instanceof Element)) return null;
	const node = target.closest("svg");
	return node instanceof SVGSVGElement ? node : null;
}

/** Projects client coordinates into an SVG viewport, or null when no screen transform exists. */
export function clientToSvgPoint(svg: SVGSVGElement, clientX: number, clientY: number): Point | null {
	const ctm = svg.getScreenCTM();
	if (!ctm) return null;

	const point = svg.createSVGPoint();
	point.x = clientX;
	point.y = clientY;
	const projected = point.matrixTransform(ctm.inverse());
	return { x: projected.x, y: projected.y };
}

/** Creates an SVG point for matrix projection within the supplied viewport. */
export function toSvgPoint(svg: SVGSVGElement, x: number, y: number): DOMPoint {
	const point = svg.createSVGPoint();
	point.x = x;
	point.y = y;
	return point;
}
