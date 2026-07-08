import type { Canvas, Point } from "./schema";

export function isPointInsideCanvas(point: Point, canvas: Canvas): boolean {
	return (
		point.x >= canvas.x &&
		point.y >= canvas.y &&
		point.x <= canvas.x + canvas.width &&
		point.y <= canvas.y + canvas.height
	);
}
