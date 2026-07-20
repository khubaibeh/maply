import { getImageRenderRect } from "@maply/model";
import type { ImageElement } from "@maply/model/types";
import { clampCropScale, fitImageRect, resizeImageRect, scaleImageRect, translateImageRect } from "editor/image/crop";
import { describe, expect, it } from "vitest";

function image(overrides: Partial<ImageElement> = {}): ImageElement {
	return {
		id: "image",
		name: "Image",
		type: "image",
		x: 100,
		y: 100,
		width: 200,
		height: 100,
		assetId: "asset",
		cropX: 20,
		cropY: -10,
		cropScale: 200,
		...overrides
	};
}

describe("clampCropScale", () => {
	it("clamps and rounds the supported zoom range", () => {
		expect(clampCropScale(50)).toBe(100);
		expect(clampCropScale(150.7)).toBe(151);
		expect(clampCropScale(1000)).toBe(800);
	});
});

describe("image crop geometry", () => {
	it("derives the legacy crop rectangle in frame-local coordinates", () => {
		expect(getImageRenderRect(image(), { width: 400, height: 200 })).toEqual({
			x: -120,
			y: -45,
			width: 400,
			height: 200
		});
	});

	it("uses an explicit image rectangle without recomputing cover scale", () => {
		const element = image({ imageX: -30, imageY: -20, imageWidth: 260, imageHeight: 140 });
		expect(getImageRenderRect({ ...element, width: 500, height: 300 }, { width: 400, height: 200 })).toEqual({
			x: -30,
			y: -20,
			width: 260,
			height: 140
		});
	});

	it("fits an image over the frame without distortion", () => {
		expect(fitImageRect({ width: 100, height: 100 }, 400, 200)).toEqual({
			x: -50,
			y: 0,
			width: 200,
			height: 100
		});
	});

	it("bounds image panning instead of scaling the image", () => {
		const rect = { x: -50, y: -25, width: 300, height: 150 };
		expect(translateImageRect(rect, { width: 200, height: 100 }, 999, 999)).toEqual({
			x: 0,
			y: 0,
			width: 300,
			height: 150
		});
		expect(translateImageRect(rect, { width: 200, height: 100 }, -999, -999)).toEqual({
			x: -100,
			y: -50,
			width: 300,
			height: 150
		});
	});

	it("changes image size only when crop zoom changes", () => {
		const rect = { x: -50, y: -25, width: 300, height: 150 };
		expect(scaleImageRect(rect, { width: 200, height: 100 }, 200, 400)).toEqual({
			x: -200,
			y: -100,
			width: 600,
			height: 300
		});
	});

	it("stretches the image with an ordinary non-proportional resize", () => {
		const previous = image({ imageX: -50, imageY: -25, imageWidth: 300, imageHeight: 150 });
		const next = image({ width: 400, height: 50 });
		expect(resizeImageRect({ x: -50, y: -25, width: 300, height: 150 }, previous, next)).toEqual({
			x: -100,
			y: -12,
			width: 600,
			height: 75
		});
	});
});
