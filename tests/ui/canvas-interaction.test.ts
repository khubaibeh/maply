import { canSelectOnCanvas } from "@components/canvas/interaction/element-selection";
import { describe, expect, it } from "vitest";

import { measureDrag } from "../../src/components/canvas/interaction/drag";
import { resizeAnchors } from "../../src/components/canvas/interaction/handles";

describe("canvas interaction", () => {
	it("reports incremental and total drag displacement", () => {
		expect(measureDrag({ x: 10, y: 20 }, { x: 14, y: 18 }, { x: 17, y: 27 })).toEqual({
			delta: { x: 3, y: 9 },
			totalDelta: { x: 7, y: 7 }
		});
	});

	it("positions all directional resize anchors", () => {
		expect(resizeAnchors({ x: 10, y: 20, width: 40, height: 20 })).toEqual([
			{ key: "nw", x: 10, y: 20 },
			{ key: "n", x: 30, y: 20 },
			{ key: "ne", x: 50, y: 20 },
			{ key: "e", x: 50, y: 30 },
			{ key: "se", x: 50, y: 40 },
			{ key: "s", x: 30, y: 40 },
			{ key: "sw", x: 10, y: 40 },
			{ key: "w", x: 10, y: 30 }
		]);
	});

	it("excludes locked elements from canvas selection interactions", () => {
		expect(canSelectOnCanvas({ locked: true })).toBe(false);
		expect(canSelectOnCanvas({ locked: false })).toBe(true);
	});
});
