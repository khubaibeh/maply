import { toPath, toPathPoints } from "editor/elements/path";
import { describe, expect, it } from "vitest";

describe("toPathPoints", () => {
	it("parses absolute M and L commands", () => {
		const points = toPathPoints("M10,20 L30,40 L50,60");
		expect(points).toEqual([
			{ x: 10, y: 20 },
			{ x: 30, y: 40 },
			{ x: 50, y: 60 }
		]);
	});

	it("parses relative m and l commands", () => {
		const points = toPathPoints("m10,20 l20,20 l20,20");
		expect(points).toEqual([
			{ x: 10, y: 20 },
			{ x: 30, y: 40 },
			{ x: 50, y: 60 }
		]);
	});

	it("parses absolute H and V commands", () => {
		const points = toPathPoints("M0,0 H100 V50");
		expect(points).toEqual([
			{ x: 0, y: 0 },
			{ x: 100, y: 0 },
			{ x: 100, y: 50 }
		]);
	});

	it("parses relative h and v commands", () => {
		const points = toPathPoints("M10,10 h50 v30");
		expect(points).toEqual([
			{ x: 10, y: 10 },
			{ x: 60, y: 10 },
			{ x: 60, y: 40 }
		]);
	});

	it("stops at Z without looping", () => {
		const points = toPathPoints("M0,0 L100,0 L50,80 Z");
		expect(points).toEqual([
			{ x: 0, y: 0 },
			{ x: 100, y: 0 },
			{ x: 50, y: 80 }
		]);
	});

	it("handles implicit L after M", () => {
		const points = toPathPoints("M0,0 10,20 30,40");
		expect(points).toEqual([
			{ x: 0, y: 0 },
			{ x: 10, y: 20 },
			{ x: 30, y: 40 }
		]);
	});

	it("handles implicit l after relative m", () => {
		const points = toPathPoints("m5,5 10,10 20,20");
		expect(points).toEqual([
			{ x: 5, y: 5 },
			{ x: 15, y: 15 },
			{ x: 35, y: 35 }
		]);
	});

	it("returns empty for unsupported curve commands", () => {
		expect(toPathPoints("M0,0 C10,20 30,40 50,60")).toEqual([]);
	});

	it("returns empty for empty string", () => {
		expect(toPathPoints("")).toEqual([]);
	});

	it("returns empty for non-finite values", () => {
		expect(toPathPoints("M0,0 LNaN,10")).toEqual([]);
	});

	it("returns empty when no command precedes coordinates", () => {
		expect(toPathPoints("10,20")).toEqual([]);
	});

	it("returns empty for Infinity coordinates", () => {
		expect(toPathPoints("M0,0 LInfinity,10")).toEqual([]);
	});

	it("returns empty for truncated coordinate pair", () => {
		expect(toPathPoints("M10")).toEqual([]);
	});

	it("returns empty for arc commands", () => {
		expect(toPathPoints("M0,0 A25,25 0 0,1 50,50")).toEqual([]);
	});

	it("returns empty for quadratic curve", () => {
		expect(toPathPoints("M0,0 Q50,100 100,0")).toEqual([]);
	});

	it("returns empty for smooth cubic", () => {
		expect(toPathPoints("M0,0 S50,100 100,0")).toEqual([]);
	});

	it("handles only whitespace", () => {
		expect(toPathPoints("   ")).toEqual([]);
	});

	it("handles Z mid-path by stopping early", () => {
		const points = toPathPoints("M0,0 L50,50 Z L100,100");
		expect(points).toEqual([
			{ x: 0, y: 0 },
			{ x: 50, y: 50 }
		]);
	});

	it("handles Z as the only command", () => {
		expect(toPathPoints("Z")).toEqual([]);
	});

	it("handles mixed case commands", () => {
		const points = toPathPoints("M0,0 l10,10 H50 v20");
		expect(points).toEqual([
			{ x: 0, y: 0 },
			{ x: 10, y: 10 },
			{ x: 50, y: 10 },
			{ x: 50, y: 30 }
		]);
	});

	it("parses negative and fractional coordinates", () => {
		const points = toPathPoints("M-5.5,3.2 L10.7,-8.1");
		expect(points).toEqual([
			{ x: -5.5, y: 3.2 },
			{ x: 10.7, y: -8.1 }
		]);
	});
});

describe("toPath", () => {
	it("serializes an open polyline", () => {
		const d = toPath(
			[
				{ x: 0, y: 0 },
				{ x: 100, y: 0 },
				{ x: 50, y: 80 }
			],
			false
		);
		expect(d).toBe("M0,0 L100,0 L50,80");
	});

	it("serializes a closed polygon", () => {
		const d = toPath(
			[
				{ x: 10, y: 10 },
				{ x: 110, y: 10 },
				{ x: 60, y: 90 }
			],
			true
		);
		expect(d).toBe("M10,10 L110,10 L60,90 Z");
	});

	it("rounds fractional coordinates", () => {
		const d = toPath(
			[
				{ x: 0.6, y: 1.4 },
				{ x: 99.5, y: 50.1 }
			],
			false
		);
		expect(d).toBe("M1,1 L100,50");
	});

	it("returns empty string for no points", () => {
		expect(toPath([], false)).toBe("");
	});

	it("round-trips through toPathPoints", () => {
		const original = [
			{ x: 10, y: 20 },
			{ x: 30, y: 40 },
			{ x: 50, y: 60 }
		];
		const d = toPath(original, false);
		expect(toPathPoints(d)).toEqual(original);
	});
});
