import type { PathElement } from "@maply/model/types";
import { Editor } from "editor";

import { pointHitsElement } from "./element-hit-test";
import { clientToSvgPoint } from "./svg";

/** Inserts a path vertex when a pointer event lands on the path's interaction geometry. */
export function insertPathVertexAtPointer(
	event: MouseEvent,
	element: PathElement,
	svg: SVGSVGElement | null,
	zoom: number
): boolean {
	if (element.locked || !svg) return false;
	const position = clientToSvgPoint(svg, event.clientX, event.clientY);
	if (!position || !pointHitsElement(element, position, zoom)) return false;

	event.preventDefault();
	event.stopPropagation();
	const transform = Editor.geometry.pathRenderTransform(element);
	Editor.element.insertPathVertex(element.id, {
		x: position.x - transform.x,
		y: position.y - transform.y
	});
	return true;
}
