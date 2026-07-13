import type { Canvas, CircleElement, ImageElement, PathElement, RectElement, TextElement } from "@maply/model/types";
import {
	clampElementToCanvas,
	getElementBounds,
	getMinimumCanvasSize,
	getPointBounds,
	getShapeDragBox
} from "editor/elements/geometry";
import { describe, expect, it } from "vitest";

const canvas: Canvas = { x: 0, y: 0, width: 800, height: 600, color: "#ffffff" };

function rect(overrides: Partial<RectElement> = {}): RectElement {
	return {
		id: "r1",
		name: "Rect1",
		type: "rect",
		x: 100,
		y: 100,
		width: 200,
		height: 150,
		fill: "#000",
		stroke: "#000",
		strokeWidth: 0,
		...overrides
	};
}

function circle(overrides: Partial<CircleElement> = {}): CircleElement {
	return {
		id: "c1",
		name: "Circle1",
		type: "circle",
		cx: 200,
		cy: 200,
		r: 50,
		fill: "#000",
		stroke: "#000",
		strokeWidth: 0,
		...overrides
	};
}

function text(overrides: Partial<TextElement> = {}): TextElement {
	return {
		id: "t1",
		name: "Text1",
		type: "text",
		x: 100,
		y: 100,
		width: 200,
		height: 50,
		text: "hello",
		fontSize: 24,
		fill: "#000",
		...overrides
	};
}

function image(overrides: Partial<ImageElement> = {}): ImageElement {
	return {
		id: "i1",
		name: "Image1",
		type: "image",
		x: 100,
		y: 100,
		width: 200,
		height: 150,
		assetId: null,
		href: "",
		cropX: 0,
		cropY: 0,
		cropScale: 100,
		...overrides
	};
}

function path(overrides: Partial<PathElement> = {}): PathElement {
	return {
		id: "p1",
		name: "Path1",
		type: "path",
		x: 10,
		y: 10,
		d: "M0,0 L100,0 L50,80",
		fill: "none",
		stroke: "#000",
		strokeWidth: 2,
		closed: false,
		...overrides
	};
}

describe("getShapeDragBox", () => {
	it("returns a box from two points", () => {
		const box = getShapeDragBox({ x: 10, y: 20 }, { x: 110, y: 120 });
		expect(box).toEqual({ x: 10, y: 20, width: 100, height: 100 });
	});

	it("normalizes when end is before start", () => {
		const box = getShapeDragBox({ x: 100, y: 100 }, { x: 10, y: 20 });
		expect(box).toEqual({ x: 10, y: 20, width: 90, height: 80 });
	});

	it("returns null when below minimum size", () => {
		expect(getShapeDragBox({ x: 0, y: 0 }, { x: 3, y: 3 })).toBeNull();
	});

	it("returns null when width is below minimum but height is not", () => {
		expect(getShapeDragBox({ x: 0, y: 0 }, { x: 2, y: 100 })).toBeNull();
	});

	it("returns null when height is below minimum but width is not", () => {
		expect(getShapeDragBox({ x: 0, y: 0 }, { x: 100, y: 2 })).toBeNull();
	});

	it("returns null for zero-area drag", () => {
		expect(getShapeDragBox({ x: 50, y: 50 }, { x: 50, y: 50 })).toBeNull();
	});

	it("returns null for square mode below minimum", () => {
		expect(getShapeDragBox({ x: 0, y: 0 }, { x: 3, y: 1 }, true)).toBeNull();
	});

	it("constrains to square using the larger dimension", () => {
		const box = getShapeDragBox({ x: 0, y: 0 }, { x: 100, y: 50 }, true);
		expect(box).toEqual({ x: 0, y: 0, width: 100, height: 100 });
	});

	it("anchors square correctly when dragging left-up", () => {
		const box = getShapeDragBox({ x: 100, y: 100 }, { x: 50, y: 70 }, true);
		expect(box!.x).toBe(100 - 50);
		expect(box!.y).toBe(100 - 50);
		expect(box!.width).toBe(50);
		expect(box!.height).toBe(50);
	});
});

describe("getMinimumCanvasSize", () => {
	it("returns 1x1 with no elements", () => {
		expect(getMinimumCanvasSize([])).toEqual({ width: 1, height: 1 });
	});

	it("uses the largest element width and height independently", () => {
		expect(
			getMinimumCanvasSize([
				rect({ width: 320, height: 40 }),
				circle({ r: 90 }),
				text({ width: 140, height: 260 })
			])
		).toEqual({ width: 320, height: 260 });
	});
});

describe("getPointBounds", () => {
	it("returns zero bounds for empty points", () => {
		expect(getPointBounds([])).toEqual({ x: 0, y: 0, width: 0, height: 0 });
	});

	it("computes axis-aligned bounding box", () => {
		const bounds = getPointBounds([
			{ x: 10, y: 20 },
			{ x: 50, y: 80 },
			{ x: 30, y: 40 }
		]);
		expect(bounds).toEqual({ x: 10, y: 20, width: 40, height: 60 });
	});

	it("handles a single point", () => {
		expect(getPointBounds([{ x: 5, y: 10 }])).toEqual({ x: 5, y: 10, width: 0, height: 0 });
	});
});

describe("getElementBounds", () => {
	it("includes cubic curve extrema in path bounds", () => {
		const bounds = getElementBounds(path({ d: "M0,0 C0,100 100,100 100,0", strokeWidth: 2 }));
		expect(bounds).toMatchObject({ width: 102, height: 77 });
	});

	it.each([
		["quadratic", "M0,0 Q50,100 100,0"],
		["smooth quadratic", "M0,0 Q25,100 50,0 T100,0"],
		["smooth cubic", "M0,0 C0,100 50,100 50,0 S100,-100 100,0"],
		["arc", "M0,0 A40,20 0 0,1 100,0"]
	])("includes %s commands in path bounds", (_name, d) => {
		const bounds = getElementBounds(path({ d }));
		expect(bounds.width).toBeGreaterThan(2);
		expect(bounds.height).toBeGreaterThan(2);
	});

	it("uses rendered glyph bearings for text bounds and wrapping", () => {
		const previousDocument = globalThis.document;
		Object.defineProperty(globalThis, "document", {
			configurable: true,
			value: {
				createElement: () => ({
					getContext: () => ({
						font: "",
						measureText: () => ({
							width: 20,
							actualBoundingBoxLeft: 3,
							actualBoundingBoxRight: 17,
							actualBoundingBoxAscent: 18,
							actualBoundingBoxDescent: 4
						})
					})
				})
			}
		});

		try {
			const element = text({ text: "first\nsecond", fontSize: 16, width: 200, height: 60 });
			expect(getElementBounds(element)).toMatchObject({ x: 97, y: 82 });
		} finally {
			Object.defineProperty(globalThis, "document", { configurable: true, value: previousDocument });
		}
	});

	it("returns frame for rect", () => {
		const bounds = getElementBounds(rect());
		expect(bounds).toEqual({ x: 100, y: 100, width: 200, height: 150 });
	});

	it("returns frame for image", () => {
		const bounds = getElementBounds(image());
		expect(bounds).toEqual({ x: 100, y: 100, width: 200, height: 150 });
	});

	it("returns bounding box for circle", () => {
		const bounds = getElementBounds(circle());
		expect(bounds).toEqual({ x: 150, y: 150, width: 100, height: 100 });
	});

	it("returns text bounds offset by fontSize", () => {
		const bounds = getElementBounds(text({ x: 50, y: 100, fontSize: 24, width: 200, height: 50 }));
		expect(bounds.y).toBe(76);
	});

	it("returns path bounds with stroke padding", () => {
		const bounds = getElementBounds(path({ x: 10, y: 10, d: "M0,0 L100,0 L50,80", strokeWidth: 4 }));
		expect(bounds.x).toBe(10);
		expect(bounds.y).toBe(10);
		expect(bounds.width).toBe(100 + 4);
		expect(bounds.height).toBe(80 + 4);
	});

	it("returns zero-size path bounds for empty path data", () => {
		const bounds = getElementBounds(path({ d: "" }));
		expect(bounds.width).toBe(0 + Math.ceil(2 / 2) * 2);
		expect(bounds.height).toBe(0 + Math.ceil(2 / 2) * 2);
	});

	it("handles circle with zero radius", () => {
		const bounds = getElementBounds(circle({ r: 0 }));
		expect(bounds.width).toBe(0);
		expect(bounds.height).toBe(0);
	});

	it("handles text with zero fontSize", () => {
		const bounds = getElementBounds(text({ fontSize: 0 }));
		expect(bounds.y).toBe(100);
	});

	it("handles negative dimensions gracefully", () => {
		const bounds = getElementBounds(rect({ width: -10, height: -20 }));
		expect(bounds.width).toBe(-10);
		expect(bounds.height).toBe(-20);
	});
});

describe("clampElementToCanvas", () => {
	it("returns unchanged element already within canvas", () => {
		const r = rect({ x: 100, y: 100, width: 200, height: 150 });
		expect(clampElementToCanvas(r, canvas)).toEqual(r);
	});

	it("clamps rect past right edge", () => {
		const r = rect({ x: 700, y: 100, width: 200, height: 150 });
		const clamped = clampElementToCanvas(r, canvas);
		expect(clamped.type === "rect" && clamped.x + clamped.width).toBeLessThanOrEqual(canvas.width);
	});

	it("clamps rect past left edge", () => {
		const r = rect({ x: -50, y: 100, width: 200, height: 150 });
		const clamped = clampElementToCanvas(r, canvas);
		expect(clamped.type === "rect" && clamped.x).toBeGreaterThanOrEqual(canvas.x);
	});

	it("clamps rect past bottom edge", () => {
		const r = rect({ x: 100, y: 500, width: 200, height: 150 });
		const clamped = clampElementToCanvas(r, canvas);
		expect(clamped.type === "rect" && clamped.y + clamped.height).toBeLessThanOrEqual(canvas.height);
	});

	it("constrains rect width to canvas width", () => {
		const r = rect({ width: 1000 });
		const clamped = clampElementToCanvas(r, canvas) as RectElement;
		expect(clamped.width).toBe(800);
	});

	it("clamps circle radius to half the smallest canvas dimension", () => {
		const c = circle({ r: 500 });
		const clamped = clampElementToCanvas(c, canvas) as CircleElement;
		expect(clamped.r).toBeLessThanOrEqual(Math.floor(Math.min(canvas.width, canvas.height) / 2));
	});

	it("clamps circle position within canvas", () => {
		const c = circle({ cx: -100, cy: -100, r: 50 });
		const clamped = clampElementToCanvas(c, canvas) as CircleElement;
		expect(clamped.cx - clamped.r).toBeGreaterThanOrEqual(canvas.x);
		expect(clamped.cy - clamped.r).toBeGreaterThanOrEqual(canvas.y);
	});

	it("constrains text fontSize to canvas height", () => {
		const t = text({ fontSize: 1000 });
		const clamped = clampElementToCanvas(t, canvas) as TextElement;
		expect(clamped.fontSize).toBeLessThanOrEqual(canvas.height);
	});

	it("rounds fractional positions", () => {
		const r = rect({ x: 10.7, y: 20.3 });
		const clamped = clampElementToCanvas(r, canvas) as RectElement;
		expect(clamped.x).toBe(10.7);
		expect(clamped.y).toBe(20.3);
	});

	it("snaps oversized element to canvas origin", () => {
		const r = rect({ x: 200, y: 200, width: 1200, height: 900 });
		const clamped = clampElementToCanvas(r, canvas) as RectElement;
		expect(clamped.x).toBe(canvas.x);
		expect(clamped.y).toBe(canvas.y);
	});

	it("works with non-zero canvas origin", () => {
		const offset: Canvas = { x: 50, y: 50, width: 400, height: 300, color: "#fff" };
		const r = rect({ x: 10, y: 10, width: 100, height: 100 });
		const clamped = clampElementToCanvas(r, offset) as RectElement;
		expect(clamped.x).toBeGreaterThanOrEqual(offset.x);
		expect(clamped.y).toBeGreaterThanOrEqual(offset.y);
	});

	it("clamps rect with zero width to minimum 1", () => {
		const r = rect({ width: 0 });
		const clamped = clampElementToCanvas(r, canvas) as RectElement;
		expect(clamped.width).toBe(1);
	});

	it("clamps rect with negative width to minimum 1", () => {
		const r = rect({ width: -50 });
		const clamped = clampElementToCanvas(r, canvas) as RectElement;
		expect(clamped.width).toBe(1);
	});

	it("clamps image with zero dimensions to minimum 1", () => {
		const i = image({ width: 0, height: 0 });
		const clamped = clampElementToCanvas(i, canvas) as ImageElement;
		expect(clamped.width).toBe(1);
		expect(clamped.height).toBe(1);
	});

	it("clamps text with zero width and height to minimum 1", () => {
		const t = text({ width: 0, height: 0 });
		const clamped = clampElementToCanvas(t, canvas) as TextElement;
		expect(clamped.width).toBe(1);
		expect(clamped.height).toBe(1);
	});

	it("clamps text fontSize to minimum 1", () => {
		const t = text({ fontSize: 0 });
		const clamped = clampElementToCanvas(t, canvas) as TextElement;
		expect(clamped.fontSize).toBe(1);
	});

	it("clamps circle with negative radius to 0", () => {
		const c = circle({ r: -10 });
		const clamped = clampElementToCanvas(c, canvas) as CircleElement;
		expect(clamped.r).toBe(0);
	});

	it("clamps all edges simultaneously", () => {
		const r = rect({ x: -500, y: -500, width: 5000, height: 5000 });
		const clamped = clampElementToCanvas(r, canvas) as RectElement;
		expect(clamped.width).toBeLessThanOrEqual(canvas.width);
		expect(clamped.height).toBeLessThanOrEqual(canvas.height);
		expect(clamped.x).toBe(canvas.x);
		expect(clamped.y).toBe(canvas.y);
	});

	it("handles 1x1 canvas", () => {
		const tiny: Canvas = { x: 0, y: 0, width: 1, height: 1, color: "#fff" };
		const r = rect({ x: 50, y: 50, width: 100, height: 100 });
		const clamped = clampElementToCanvas(r, tiny) as RectElement;
		expect(clamped.width).toBe(1);
		expect(clamped.height).toBe(1);
		expect(clamped.x).toBe(0);
		expect(clamped.y).toBe(0);
	});
});
