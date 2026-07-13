import { describe, expect, it } from "vitest";

import { panFromDrag, zoomAt } from "../../src/components/core/canvas-area/camera";
import { clampAlongSegment, movePath } from "../../src/components/core/canvas-area/path-drawing";

describe("canvas area transitions", () => {
	it("keeps the pointer world position stable while zooming", () => {
		expect(zoomAt({ x: 10, y: 20, zoom: 2 }, { x: 100, y: 80 }, 4)).toEqual({ x: 35, y: 40, zoom: 4 });
	});

	it("pans from an immutable camera snapshot", () => {
		expect(panFromDrag({ x: 10, y: 20, zoom: 2 }, { x: 100, y: 100 }, { x: 80, y: 130 })).toEqual({ x: 20, y: 5 });
	});

	it("clips path segments at the canvas edge", () => {
		expect(
			clampAlongSegment(
				{ x: 50, y: 50 },
				{ x: 150, y: 100 },
				{ x: 0, y: 0, width: 100, height: 100, color: "#fff" }
			)
		).toEqual({ x: 100, y: 75 });
	});

	it("detects the close handle after snapping and clamping", () => {
		const session = {
			points: [
				{ x: 10, y: 10 },
				{ x: 50, y: 50 }
			],
			current: { x: 50, y: 50 },
			nearFirst: false
		};
		expect(
			movePath(session, { x: 12, y: 12 }, { x: 0, y: 0, width: 100, height: 100, color: "#fff" }, 4).nearFirst
		).toBe(true);
	});
});
