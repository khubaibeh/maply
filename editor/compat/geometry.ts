import { getPathRenderTransform as getCompatPathRenderTransform } from "@app/internal/element-actions";
import { getImageRenderRect as getLegacyImageRenderRect } from "@app/internal/image-assets";
import { getPathDataBounds as getLegacyPathDataBounds } from "@app/internal/path-geometry";
import type { ImageElement, PathElement, Point } from "@maply/model/types";

/** Legacy path point bounds used by current path handle UI. */
export function getPathDataBounds(points: Point[]) {
	return getLegacyPathDataBounds(points);
}

/** Legacy translation from stored visual box to rendered SVG path data origin. */
export function getPathRenderTransform(element: PathElement): Point {
	return getCompatPathRenderTransform(element);
}

/** Legacy image crop render rectangle used by current SVG/image UI. */
export function getImageRenderRect(element: ImageElement & { assetWidth: number; assetHeight: number }) {
	return getLegacyImageRenderRect(element);
}
