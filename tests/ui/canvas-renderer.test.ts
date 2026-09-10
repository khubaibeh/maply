import { describe, expect, it } from "vitest";

import { chooseCanvasRenderer } from "../../src/components/canvas/canvas-renderer";

describe("canvas renderer decision", () => {
	it("keeps ordinary and culled documents in SVG", () => {
		expect(chooseCanvasRenderer(1_000, 1_000)).toBe("svg");
		expect(chooseCanvasRenderer(50_000, 2_000)).toBe("svg");
		expect(chooseCanvasRenderer(50_000, 2_001)).toBe("canvas");
	});

	it("does not activate a scene for an empty document", () => {
		expect(chooseCanvasRenderer(0, 50_000)).toBe("svg");
	});
});
