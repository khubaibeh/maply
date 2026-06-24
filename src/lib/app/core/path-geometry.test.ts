import { describe, expect, it } from "vitest";

import { getPathDataBounds, getPathPoints, pathDataFromPoints, updatePathVertex } from "./path-geometry";

describe("pathDataFromPoints", () => {
	it("creates an open polyline", () => {
		const d = pathDataFromPoints(
			[
				{ x: 0, y: 0 },
				{ x: 100, y: 0 },
				{ x: 50, y: 80 }
			],
			false
		);
		expect(d).toBe("M0,0 L100,0 L50,80");
	});

	it("creates a closed polygon", () => {
		const d = pathDataFromPoints(
			[
				{ x: 10, y: 10 },
				{ x: 110, y: 10 },
				{ x: 60, y: 90 }
			],
			true
		);
		expect(d).toBe("M10,10 L110,10 L60,90 Z");
	});

	it("rounds coordinates", () => {
		const d = pathDataFromPoints(
			[
				{ x: 0.6, y: 1.4 },
				{ x: 99.5, y: 50.1 }
			],
			false
		);
		expect(d).toBe("M1,1 L100,50");
	});
});

describe("getPathPoints", () => {
	it("parses an absolute open path", () => {
		const points = getPathPoints("M0,0 L100,0 L50,80");
		expect(points).toEqual([
			{ x: 0, y: 0 },
			{ x: 100, y: 0 },
			{ x: 50, y: 80 }
		]);
	});

	it("parses a closed path and ignores the Z command", () => {
		const points = getPathPoints("M10,10 L110,10 L60,90 Z");
		expect(points).toEqual([
			{ x: 10, y: 10 },
			{ x: 110, y: 10 },
			{ x: 60, y: 90 }
		]);
	});

	it("parses relative commands", () => {
		const points = getPathPoints("M0,0 l100,0 l-50,80");
		expect(points).toEqual([
			{ x: 0, y: 0 },
			{ x: 100, y: 0 },
			{ x: 50, y: 80 }
		]);
	});

	it("parses horizontal and vertical lines", () => {
		const points = getPathPoints("M0,0 H100 V80");
		expect(points).toEqual([
			{ x: 0, y: 0 },
			{ x: 100, y: 0 },
			{ x: 100, y: 80 }
		]);
	});

	it("returns an empty array for unsupported curve commands", () => {
		expect(getPathPoints("M0,0 Q50,100 100,0")).toEqual([]);
		expect(getPathPoints("M0,0 C0,100 100,100 100,0")).toEqual([]);
	});
});

describe("getPathDataBounds", () => {
	it("computes bounds for points", () => {
		const bounds = getPathDataBounds([
			{ x: 10, y: 20 },
			{ x: 100, y: 5 },
			{ x: 50, y: 80 }
		]);
		expect(bounds).toEqual({ x: 10, y: 5, width: 90, height: 75 });
	});

	it("returns zero bounds for no points", () => {
		expect(getPathDataBounds([])).toEqual({ x: 0, y: 0, width: 0, height: 0 });
	});
});

describe("updatePathVertex", () => {
	it("replaces a vertex and recomputes bounds", () => {
		const result = updatePathVertex("M0,0 L100,0 L50,100 Z", 1, { x: 200, y: 0 });
		expect(result.d).toBe("M0,0 L200,0 L50,100 Z");
		expect(result.bounds).toEqual({ x: 0, y: 0, width: 200, height: 100 });
	});

	it("preserves the closed flag when open", () => {
		const result = updatePathVertex("M0,0 L100,0 L50,80", 2, { x: 50, y: 100 });
		expect(result.d).toBe("M0,0 L100,0 L50,100");
		expect(result.bounds).toEqual({ x: 0, y: 0, width: 100, height: 100 });
	});

	it("ignores out-of-range indices", () => {
		const result = updatePathVertex("M0,0 L100,0", 5, { x: 999, y: 999 });
		expect(result.d).toBe("M0,0 L100,0");
	});
});
