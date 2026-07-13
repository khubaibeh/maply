import type { Camera, Point } from "@maply/model/types";

/** Returns a camera zoomed around a viewport-local pointer position. */
export function zoomAt(camera: Camera, pointer: Point, nextZoom: number): Camera {
	const worldX = camera.x + pointer.x / camera.zoom;
	const worldY = camera.y + pointer.y / camera.zoom;
	return {
		zoom: nextZoom,
		x: worldX - pointer.x / nextZoom,
		y: worldY - pointer.y / nextZoom
	};
}

/** Returns camera coordinates for a screen-space pan drag. */
export function panFromDrag(camera: Camera, start: Point, current: Point): Pick<Camera, "x" | "y"> {
	return {
		x: camera.x + (start.x - current.x) / camera.zoom,
		y: camera.y + (start.y - current.y) / camera.zoom
	};
}
