import { clampCropScale, cropForFrameResize, getCropMetrics, translateCrop } from "editor/image/crop";
import { describe, expect, it } from "vitest";

describe("clampCropScale", () => {
	it("clamps below minimum to 100", () => {
		expect(clampCropScale(50)).toBe(100);
	});

	it("clamps above maximum to 800", () => {
		expect(clampCropScale(1000)).toBe(800);
	});

	it("rounds to nearest integer", () => {
		expect(clampCropScale(150.7)).toBe(151);
	});

	it("passes through a valid value", () => {
		expect(clampCropScale(300)).toBe(300);
	});

	it("clamps negative scale to 100", () => {
		expect(clampCropScale(-200)).toBe(100);
	});

	it("clamps zero to 100", () => {
		expect(clampCropScale(0)).toBe(100);
	});
});

describe("getCropMetrics", () => {
	it("returns zero overflow when asset fits exactly", () => {
		const metrics = getCropMetrics({ width: 200, height: 100, assetWidth: 200, assetHeight: 100, cropScale: 100 });
		expect(metrics.overflowX).toBe(0);
		expect(metrics.overflowY).toBe(0);
	});

	it("returns overflow when asset is scaled up", () => {
		const metrics = getCropMetrics({ width: 200, height: 100, assetWidth: 200, assetHeight: 100, cropScale: 200 });
		expect(metrics.overflowX).toBeGreaterThan(0);
		expect(metrics.overflowY).toBeGreaterThan(0);
	});

	it("normalizes zero asset dimensions to 1", () => {
		const metrics = getCropMetrics({ width: 100, height: 100, assetWidth: 0, assetHeight: 0, cropScale: 100 });
		expect(Number.isFinite(metrics.overflowX)).toBe(true);
		expect(Number.isFinite(metrics.overflowY)).toBe(true);
	});

	it("normalizes zero frame dimensions to 1", () => {
		const metrics = getCropMetrics({ width: 0, height: 0, assetWidth: 100, assetHeight: 100, cropScale: 100 });
		expect(Number.isFinite(metrics.overflowX)).toBe(true);
		expect(Number.isFinite(metrics.overflowY)).toBe(true);
	});

	it("produces larger overflow at higher crop scale", () => {
		const base = { width: 200, height: 100, assetWidth: 400, assetHeight: 200 };
		const at200 = getCropMetrics({ ...base, cropScale: 200 });
		const at400 = getCropMetrics({ ...base, cropScale: 400 });
		expect(at400.overflowX).toBeGreaterThan(at200.overflowX);
		expect(at400.overflowY).toBeGreaterThan(at200.overflowY);
	});
});

describe("translateCrop", () => {
	const metrics = { width: 200, height: 100, assetWidth: 400, assetHeight: 200, cropScale: 200 };

	it("pans crop offsets in response to drag deltas", () => {
		const crop = translateCrop({ cropX: 0, cropY: 0, cropScale: 200 }, 10, 5, metrics);
		expect(crop.cropX).not.toBe(0);
		expect(crop.cropY).not.toBe(0);
	});

	it("clamps crop offsets to -100..100", () => {
		const crop = translateCrop({ cropX: 0, cropY: 0, cropScale: 200 }, 99999, 99999, metrics);
		expect(crop.cropX).toBeGreaterThanOrEqual(-100);
		expect(crop.cropX).toBeLessThanOrEqual(100);
		expect(crop.cropY).toBeGreaterThanOrEqual(-100);
		expect(crop.cropY).toBeLessThanOrEqual(100);
	});

	it("preserves offsets when overflow is zero", () => {
		const noOverflow = { width: 200, height: 100, assetWidth: 200, assetHeight: 100, cropScale: 100 };
		const crop = translateCrop({ cropX: 50, cropY: -30, cropScale: 100 }, 20, 20, noOverflow);
		expect(crop.cropX).toBe(50);
		expect(crop.cropY).toBe(-30);
	});

	it("rounds output to integers", () => {
		const crop = translateCrop({ cropX: 0, cropY: 0, cropScale: 200 }, 1, 1, metrics);
		expect(crop.cropX).toBe(Math.round(crop.cropX));
		expect(crop.cropY).toBe(Math.round(crop.cropY));
	});

	it("clamps extreme negative deltas to 100 (inverted)", () => {
		const crop = translateCrop({ cropX: 0, cropY: 0, cropScale: 200 }, -99999, -99999, metrics);
		expect(crop.cropX).toBe(100);
		expect(crop.cropY).toBe(100);
	});

	it("clamps extreme positive deltas to -100 (inverted)", () => {
		const crop = translateCrop({ cropX: 0, cropY: 0, cropScale: 200 }, 99999, 99999, metrics);
		expect(crop.cropX).toBe(-100);
		expect(crop.cropY).toBe(-100);
	});

	it("does not exceed bounds when starting at boundary", () => {
		const crop = translateCrop({ cropX: 100, cropY: 100, cropScale: 200 }, -50, -50, metrics);
		expect(crop.cropX).toBeLessThanOrEqual(100);
		expect(crop.cropY).toBeLessThanOrEqual(100);
	});

	it("handles zero deltas without changing offsets", () => {
		const crop = translateCrop({ cropX: 42, cropY: -17, cropScale: 200 }, 0, 0, metrics);
		expect(crop.cropX).toBe(42);
		expect(crop.cropY).toBe(-17);
	});
});

describe("getCropMetrics edge cases", () => {
	it("handles negative asset dimensions", () => {
		const metrics = getCropMetrics({ width: 100, height: 100, assetWidth: -50, assetHeight: -50, cropScale: 100 });
		expect(Number.isFinite(metrics.overflowX)).toBe(true);
		expect(Number.isFinite(metrics.overflowY)).toBe(true);
	});

	it("handles negative frame dimensions", () => {
		const metrics = getCropMetrics({
			width: -100,
			height: -100,
			assetWidth: 200,
			assetHeight: 200,
			cropScale: 100
		});
		expect(Number.isFinite(metrics.overflowX)).toBe(true);
		expect(Number.isFinite(metrics.overflowY)).toBe(true);
	});

	it("handles cropScale below 100 as 100", () => {
		const at50 = getCropMetrics({ width: 200, height: 100, assetWidth: 400, assetHeight: 200, cropScale: 50 });
		const at100 = getCropMetrics({ width: 200, height: 100, assetWidth: 400, assetHeight: 200, cropScale: 100 });
		expect(at50.overflowX).toBe(at100.overflowX);
		expect(at50.overflowY).toBe(at100.overflowY);
	});

	it("never returns negative overflow", () => {
		const metrics = getCropMetrics({ width: 1000, height: 1000, assetWidth: 10, assetHeight: 10, cropScale: 100 });
		expect(metrics.overflowX).toBeGreaterThanOrEqual(0);
		expect(metrics.overflowY).toBeGreaterThanOrEqual(0);
	});
});

describe("cropForFrameResize", () => {
	const asset = { assetWidth: 400, assetHeight: 200 };

	it("preserves centered crop when scaling proportionally", () => {
		const prev = { width: 200, height: 100, ...asset, cropScale: 200 };
		const next = { width: 400, height: 200, ...asset, cropScale: 200 };
		const crop = cropForFrameResize({ cropX: 0, cropY: 0, cropScale: 200 }, prev, next);
		expect(crop.cropX).toBe(0);
		expect(crop.cropY).toBe(0);
	});

	it("preserves off-center crop through proportional resize", () => {
		const prev = { width: 200, height: 100, ...asset, cropScale: 200 };
		const crop = cropForFrameResize({ cropX: 50, cropY: -30, cropScale: 200 }, prev, prev);
		expect(crop.cropX).toBe(50);
		expect(crop.cropY).toBe(-30);
	});

	it("adjusts cropScale to maintain effective zoom", () => {
		const prev = { width: 200, height: 100, ...asset, cropScale: 200 };
		const next = { width: 100, height: 50, ...asset, cropScale: 200 };
		const crop = cropForFrameResize({ cropX: 0, cropY: 0, cropScale: 200 }, prev, next);
		expect(crop.cropScale).toBeGreaterThan(200);
	});

	it("clamps cropScale to 800 when frame shrinks dramatically", () => {
		const prev = { width: 400, height: 400, ...asset, cropScale: 800 };
		const next = { width: 10, height: 10, ...asset, cropScale: 800 };
		const crop = cropForFrameResize({ cropX: 0, cropY: 0, cropScale: 800 }, prev, next);
		expect(crop.cropScale).toBeLessThanOrEqual(800);
	});

	it("clamps crop offsets to -100..100 after resize", () => {
		const prev = { width: 200, height: 100, ...asset, cropScale: 800 };
		const next = { width: 200, height: 100, ...asset, cropScale: 100 };
		const crop = cropForFrameResize({ cropX: 100, cropY: -100, cropScale: 800 }, prev, next);
		expect(crop.cropX).toBeGreaterThanOrEqual(-100);
		expect(crop.cropX).toBeLessThanOrEqual(100);
		expect(crop.cropY).toBeGreaterThanOrEqual(-100);
		expect(crop.cropY).toBeLessThanOrEqual(100);
	});

	it("returns zero offsets when new frame has no overflow", () => {
		const prev = { width: 200, height: 100, ...asset, cropScale: 200 };
		const next = { width: 800, height: 400, ...asset, cropScale: 100 };
		const crop = cropForFrameResize({ cropX: 50, cropY: 50, cropScale: 200 }, prev, next);
		expect(crop.cropX).toBe(0);
		expect(crop.cropY).toBe(0);
	});

	it("handles zero next dimensions without producing NaN", () => {
		const prev = { width: 200, height: 100, ...asset, cropScale: 200 };
		const next = { width: 0, height: 0, ...asset, cropScale: 200 };
		const crop = cropForFrameResize({ cropX: 50, cropY: 50, cropScale: 200 }, prev, next);
		expect(Number.isFinite(crop.cropX)).toBe(true);
		expect(Number.isFinite(crop.cropY)).toBe(true);
		expect(Number.isFinite(crop.cropScale)).toBe(true);
	});

	it("handles zero previous overflow (no pan was possible)", () => {
		const prev = { width: 400, height: 200, assetWidth: 400, assetHeight: 200, cropScale: 100 };
		const next = { width: 200, height: 100, assetWidth: 400, assetHeight: 200, cropScale: 100 };
		const crop = cropForFrameResize({ cropX: 0, cropY: 0, cropScale: 100 }, prev, next);
		expect(crop.cropX).toBe(0);
		expect(crop.cropY).toBe(0);
	});

	it("identity: same previous and next returns same crop", () => {
		const frame = { width: 300, height: 150, ...asset, cropScale: 300 };
		const crop = cropForFrameResize({ cropX: -42, cropY: 73, cropScale: 300 }, frame, frame);
		expect(crop.cropX).toBe(-42);
		expect(crop.cropY).toBe(73);
		expect(crop.cropScale).toBe(300);
	});
});
