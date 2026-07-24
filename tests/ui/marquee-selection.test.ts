import { describe, expect, it } from "vitest";

import {
	exceedsMarqueeThreshold,
	getMarqueeBounds,
	intersectsBounds,
	resolveMarqueeSelection
} from "../../src/components/canvas/interaction/marquee";

describe("marquee selection geometry", () => {
	it("normalizes a drag in any direction", () => {
		expect(getMarqueeBounds({ x: 80, y: 60 }, { x: 20, y: 10 })).toEqual({
			x: 20,
			y: 10,
			width: 60,
			height: 50
		});
	});

	it("selects bounds that overlap the marquee", () => {
		const marquee = { x: 10, y: 10, width: 100, height: 100 };

		expect(intersectsBounds(marquee, { x: 20, y: 20, width: 80, height: 80 })).toBe(true);
		expect(intersectsBounds(marquee, { x: 5, y: 20, width: 80, height: 80 })).toBe(true);
		expect(intersectsBounds(marquee, { x: 20, y: 20, width: 100, height: 80 })).toBe(true);
		expect(intersectsBounds(marquee, { x: 111, y: 20, width: 10, height: 10 })).toBe(false);
	});

	it("uses a zoom-compensated movement threshold", () => {
		expect(exceedsMarqueeThreshold({ x: 2, y: 0 }, 1, 3)).toBe(false);
		expect(exceedsMarqueeThreshold({ x: 2, y: 0 }, 2, 3)).toBe(true);
	});

	it("preserves selection for an additive click and cancellation", () => {
		expect(resolveMarqueeSelection(["a"], [], true, false, false)).toEqual(["a"]);
		expect(resolveMarqueeSelection(["a"], ["b"], true, true, false)).toEqual(["a", "b"]);
		expect(resolveMarqueeSelection(["a"], ["b"], false, true, true)).toBeNull();
	});
});
