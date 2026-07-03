import { isPointInsideCanvas, type Point } from "../domain/geometry";
import { getElementBounds, getPathRenderTransform, getShapeDragBox, type ResizeHandle } from "./element-actions";
import { getImageRenderRect } from "./image-assets";
import { getPathDataBounds, getPathPoints, snapPathSegment, updatePathVertex } from "./path-geometry";

export { type Point, type ResizeHandle };

export const appGeometry = {
	shapeDragBox: getShapeDragBox,
	elementBounds: getElementBounds,
	pathRenderTransform: getPathRenderTransform,
	pathBounds: getPathDataBounds,
	pathPoints: getPathPoints,
	snapPathSegment,
	updatePathVertex,
	imageRenderRect: getImageRenderRect,
	isPointInsideCanvas
} as const;
