import { getImageRenderRect } from "$lib/app/core/image-assets";
import { getPathDataBounds, getPathPoints, updatePathVertex } from "$lib/app/core/path-geometry";
import { isPointInsideCanvas, type Point } from "$lib/app/domain/geometry";

import { getElementBounds, getPathRenderTransform, getShapeDragBox, type ResizeHandle } from "./element";

export { type Point, type ResizeHandle };

export const appGeometry = {
	shapeDragBox: getShapeDragBox,
	elementBounds: getElementBounds,
	pathRenderTransform: getPathRenderTransform,
	pathBounds: getPathDataBounds,
	pathPoints: getPathPoints,
	updatePathVertex,
	imageRenderRect: getImageRenderRect,
	isPointInsideCanvas
} as const;
