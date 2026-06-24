import { describe, expect, it } from "vitest";

import {
	cloneStoredImageAsset,
	createStoredImageAsset,
	getImageCropStateForFrameResize,
	getImageCropMetrics,
	getImageRenderRect,
	normalizeSvgMarkup,
	normalizeSvgToDataUrl,
	translateImageCrop
} from "./image-assets";

describe("normalizeSvgMarkup", () => {
	it("strips xml declarations and ensures xmlns", () => {
		const normalized = normalizeSvgMarkup('<?xml version="1.0"?><svg viewBox="0 0 10 10"></svg>');
		expect(normalized).toBe('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>');
	});

	it("rejects script tags", () => {
		expect(() => normalizeSvgMarkup("<svg><script>alert(1)</script></svg>")).toThrow(/script/i);
	});

	it("rejects external hrefs", () => {
		expect(() => normalizeSvgMarkup('<svg><image href="https://example.com/a.png" /></svg>')).toThrow(
			/self-contained/i
		);
	});

	it("encodes normalized svg data urls", () => {
		const dataUrl = normalizeSvgToDataUrl("<svg></svg>");
		expect(dataUrl.startsWith("data:image/svg+xml;charset=utf-8,")).toBe(true);
		expect(decodeURIComponent(dataUrl.split(",")[1] ?? "")).toContain("xmlns=");
	});
});

describe("image asset helpers", () => {
	it("creates isolated project-owned image asset records", () => {
		const asset = createStoredImageAsset("prod", {
			name: "photo.png",
			mimeType: "image/png",
			dataUrl: "data:image/png;base64,abc",
			width: 640,
			height: 480
		});

		expect(asset.projectId).toBe("prod");
		expect(asset.id.length).toBeGreaterThan(0);
	});

	it("clones image assets with a new id", () => {
		const asset = createStoredImageAsset("prod", {
			name: "photo.png",
			mimeType: "image/png",
			dataUrl: "data:image/png;base64,abc",
			width: 640,
			height: 480
		});
		const clone = cloneStoredImageAsset(asset, "prod");

		expect(clone.id).not.toBe(asset.id);
		expect(clone.dataUrl).toBe(asset.dataUrl);
	});
});

describe("getImageRenderRect", () => {
	it("covers the frame by default", () => {
		expect(
			getImageRenderRect({
				x: 10,
				y: 20,
				width: 100,
				height: 100,
				assetWidth: 200,
				assetHeight: 100,
				cropX: 0,
				cropY: 0,
				cropScale: 100
			})
		).toEqual({ x: -40, y: 20, width: 200, height: 100 });
	});

	it("uses frame-fill scaling with crop zoom", () => {
		expect(
			getImageRenderRect({
				x: 10,
				y: 20,
				width: 100,
				height: 100,
				assetWidth: 100,
				assetHeight: 100,
				cropX: 0,
				cropY: 0,
				cropScale: 150
			})
		).toEqual({ x: -15, y: -5, width: 150, height: 150 });
	});

	it("reports overflow for interactive crop panning", () => {
		expect(
			getImageCropMetrics({
				width: 100,
				height: 100,
				assetWidth: 200,
				assetHeight: 100,
				cropScale: 100
			})
		).toEqual({ scaledWidth: 200, scaledHeight: 100, overflowX: 100, overflowY: 0 });
	});

	it("applies crop scale and panning", () => {
		expect(
			getImageRenderRect({
				x: 0,
				y: 0,
				width: 100,
				height: 100,
				assetWidth: 100,
				assetHeight: 100,
				cropX: 100,
				cropY: -100,
				cropScale: 200
			})
		).toEqual({ x: -100, y: 0, width: 200, height: 200 });
	});

	it("translates crop by pointer drag within available overflow", () => {
		expect(
			translateImageCrop({ cropX: 0, cropY: 0, cropScale: 100 }, 25, 0, {
				width: 100,
				height: 100,
				assetWidth: 200,
				assetHeight: 100,
				cropScale: 100
			})
		).toEqual({ cropX: -50, cropY: 0 });
	});

	it("preserves the rendered image when resizing the frame horizontally", () => {
		const current = { cropX: 0, cropY: 0, cropScale: 100 };
		const previousFrame = { x: 100, y: 100, width: 300, height: 180 };
		const nextFrame = { x: 100, y: 100, width: 220, height: 180 };
		const asset = { assetWidth: 1200, assetHeight: 800 };
		const previousRect = getImageRenderRect({
			...previousFrame,
			...asset,
			...current
		});

		const nextCrop = getImageCropStateForFrameResize(current, {
			previousFrame,
			nextFrame,
			...asset
		});
		const nextRect = getImageRenderRect({
			...nextFrame,
			...asset,
			...nextCrop
		});

		expect(nextRect.width).toBe(previousRect.width);
		expect(nextRect.height).toBe(previousRect.height);
		expect(nextRect.x).toBe(previousRect.x);
		expect(nextRect.y).toBe(previousRect.y);
		expect(nextCrop.cropScale).toBeGreaterThan(100);
	});
});
