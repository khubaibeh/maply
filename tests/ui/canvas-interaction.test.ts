import {
	createElementHitTester,
	getPathHitTolerance,
	topmostHitElement
} from "@components/canvas/interaction/element-hit-test";
import { canSelectOnCanvas, canvasElementPointerAction } from "@components/canvas/interaction/element-selection";
import type { CircleElement, PathElement } from "@maply/model/types";
import { describe, expect, it } from "vitest";

import { chooseCanvasRenderer } from "../../src/components/canvas/canvas-renderer";
import { measureDrag } from "../../src/components/canvas/interaction/drag";
import { resizeAnchors } from "../../src/components/canvas/interaction/handles";

describe("canvas interaction", () => {
	function circle(overrides: Partial<CircleElement> = {}): CircleElement {
		return {
			id: "circle",
			name: "Circle",
			type: "circle",
			locked: false,
			visible: true,
			bindable: true,
			cx: 100,
			cy: 100,
			r: 50,
			fill: "#000",
			stroke: "none",
			strokeWidth: 0,
			...overrides
		};
	}

	function path(overrides: Partial<PathElement> = {}): PathElement {
		return {
			id: "path",
			name: "Path",
			type: "path",
			locked: false,
			visible: true,
			bindable: true,
			x: 50,
			y: 50,
			d: "M0,0 L100,0 L100,100 L0,100",
			fill: "none",
			stroke: "#000",
			strokeWidth: 1,
			closed: false,
			...overrides
		};
	}

	it("keeps dense Canvas picking shape-accurate across overlapping circles and paths", () => {
		const renderer = chooseCanvasRenderer(50_000, 2_001);
		const hitTester = createElementHitTester();
		const bottom = circle({ id: "bottom" });
		const topCircle = circle({ id: "top-circle", r: 20 });
		const top = path({ id: "top" });

		expect(renderer).toBe("canvas");
		expect(topmostHitElement([bottom, topCircle], { x: 130, y: 130 }, 1, hitTester)?.id).toBe("bottom");
		expect(topmostHitElement([bottom, top], { x: 100, y: 100 }, 1, hitTester)?.id).toBe("bottom");
		expect(topmostHitElement([bottom, top], { x: 140, y: 140 }, 1, hitTester)).toBeNull();
		expect(topmostHitElement([top], { x: 100, y: 56 }, 1, hitTester)?.id).toBe("top");
		expect(topmostHitElement([top], { x: 100, y: 56 }, 2, hitTester)).toBeNull();
		expect(getPathHitTolerance(2)).toBe(3.5);

		hitTester.dispose();
	});

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

	it("clears the current selection when a locked canvas element is clicked", () => {
		expect(canvasElementPointerAction({ locked: true })).toBe("clear-selection");
		expect(canvasElementPointerAction({ locked: false })).toBe("interact");
	});
});
