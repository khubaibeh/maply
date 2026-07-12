import type { ImageElement, PathElement, Point } from "@maply/model/types";

import { getPointBounds } from "../elements/geometry";
import { toPathPoints } from "../elements/path";

/** Legacy path point bounds used by current path handle UI. */
export function getPathDataBounds(points: Point[]) {
	return getPointBounds(points);
}

/** Legacy translation from stored visual box to rendered SVG path data origin. */
export function getPathRenderTransform(element: PathElement): Point {
	const bounds = getPointBounds(toPathPoints(element.d));
	const strokePadding = Math.ceil(element.strokeWidth / 2);
	return {
		x: Math.round(element.x - bounds.x + strokePadding),
		y: Math.round(element.y - bounds.y + strokePadding)
	};
}

/** Legacy image crop render rectangle used by current SVG/image UI. */
export function getImageRenderRect(element: ImageElement & { assetWidth: number; assetHeight: number }) {
	const frameWidth = Math.max(1, element.width);
	const frameHeight = Math.max(1, element.height);
	const assetWidth = Math.max(1, element.assetWidth);
	const assetHeight = Math.max(1, element.assetHeight);
	const baseScale = Math.max(frameWidth / assetWidth, frameHeight / assetHeight);
	const cropScale = Math.max(1, element.cropScale / 100);
	const width = assetWidth * baseScale * cropScale;
	const height = assetHeight * baseScale * cropScale;
	const overflowX = Math.max(0, width - frameWidth);
	const overflowY = Math.max(0, height - frameHeight);
	const x = element.x + (frameWidth - width) / 2 - (clamp(element.cropX, -100, 100) / 100) * (overflowX / 2);
	const y = element.y + (frameHeight - height) / 2 - (clamp(element.cropY, -100, 100) / 100) * (overflowY / 2);
	return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}
