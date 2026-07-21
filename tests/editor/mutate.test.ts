import type { Element, ImageElement, RectElement } from "@maply/model/types";
import {
	resizeElementByHandle,
	renameElement,
	translateElement,
	translateElements,
	updateElement,
	updateElements
} from "editor/elements/mutate";
import { imageAssetState } from "editor/state/assets";
import { projectState, updateProjectState } from "editor/state/document";
import { canvasState } from "editor/state/workspace";
import { get } from "svelte/store";
import { describe, expect, it } from "vitest";

function rect(id: string, x: number, y: number): RectElement {
	return {
		id,
		name: id,
		type: "rect",
		x,
		y,
		width: 100,
		height: 100,
		fill: "#000",
		stroke: "#000",
		strokeWidth: 1
	};
}

function image(): ImageElement {
	return {
		id: "image",
		name: "Image",
		type: "image",
		x: 50,
		y: 50,
		width: 200,
		height: 100,
		assetId: "asset",
		cropX: 0,
		cropY: 0,
		cropScale: 200
	};
}

function setFixture(elements: Element[]) {
	canvasState.set({ width: 300, height: 300, color: "#fff", x: 0, y: 0, camera: { x: 0, y: 0, zoom: 1 } });
	updateProjectState((state) => ({ ...state, elements }), "rescan");
}

describe("translateElement", () => {
	it("returns the applied delta when movement is clamped at the canvas edge", () => {
		setFixture([rect("a", 180, 40)]);

		expect(translateElement("a", 200, 0)).toEqual({ x: 20, y: 0 });
		expect(get(projectState).elements[0]).toMatchObject({ x: 200, y: 40 });
	});

	it("returns the clamped group delta for multi-selection moves", () => {
		setFixture([rect("a", 0, 0), rect("b", 180, 0)]);

		expect(translateElements(["a", "b"], 50, 0)).toEqual({ x: 20, y: 0 });
		expect(get(projectState).elements).toMatchObject([
			{ id: "a", x: 20, y: 0 },
			{ id: "b", x: 200, y: 0 }
		]);
	});
});

describe("updateElements", () => {
	it("does not write blank names", () => {
		setFixture([rect("a", 10, 20), rect("b", 30, 40)]);

		updateElements(["a", "b"], { name: "   " });
		renameElement("a", "");

		expect(get(projectState).elements.map((element) => element.name)).toEqual(["a", "b"]);
	});

	it("updates multiple elements in one state transition", () => {
		setFixture([rect("a", 10, 20), rect("b", 30, 40)]);

		updateElements(["a", "b"], { fill: "#fff" });

		expect(get(projectState).elements).toMatchObject([
			{ id: "a", fill: "#fff" },
			{ id: "b", fill: "#fff" }
		]);
	});

	it("leaves elements outside the target IDs unchanged", () => {
		const selected = rect("selected", 10, 20);
		const untouched = rect("untouched", 30, 40);
		setFixture([selected, untouched]);

		updateElements([selected.id, "missing"], { fill: "#fff" });

		expect(get(projectState).elements).toEqual([{ ...selected, fill: "#fff" }, untouched]);
	});

	it("clamps each targeted element to the canvas", () => {
		setFixture([rect("a", 10, 20), rect("b", 30, 40)]);

		updateElements(["a", "b"], { x: 400 });

		expect(get(projectState).elements).toMatchObject([
			{ id: "a", x: 200 },
			{ id: "b", x: 200 }
		]);
	});

	it("preserves image render geometry when updating image dimensions in a batch", () => {
		const source = image();
		const rectangle = rect("rect", 10, 20);
		setFixture([source, rectangle]);
		imageAssetState.set({
			asset: {
				id: "asset",
				projectId: "prod",
				name: "image.png",
				mimeType: "image/png",
				dataUrl: "data:image/png;base64,AA==",
				width: 400,
				height: 200
			}
		});
		canvasState.set({ width: 500, height: 300, color: "#fff", x: 0, y: 0, camera: { x: 0, y: 0, zoom: 1 } });

		updateElements([source.id, rectangle.id], { width: 400 });

		expect(get(projectState).elements).toMatchObject([
			{
				id: source.id,
				width: 400,
				cropScale: 200,
				imageX: -200,
				imageY: -50,
				imageWidth: 800,
				imageHeight: 200
			},
			{ id: rectangle.id, width: 400 }
		]);
	});
});

describe("resizeElementByHandle", () => {
	it("preserves image crop values when resizing its frame", () => {
		const source = image();
		setFixture([source]);
		imageAssetState.set({
			asset: {
				id: "asset",
				projectId: "prod",
				name: "image.png",
				mimeType: "image/png",
				dataUrl: "data:image/png;base64,AA==",
				width: 400,
				height: 200
			}
		});
		canvasState.set({ width: 500, height: 300, color: "#fff", x: 0, y: 0, camera: { x: 0, y: 0, zoom: 1 } });

		resizeElementByHandle(source.id, "e", 80, 0);

		const resized = get(projectState).elements[0] as ImageElement;

		expect(resized.width).toBe(280);
		expect(resized.cropX).toBe(source.cropX);
		expect(resized.cropY).toBe(source.cropY);
		expect(resized.cropScale).toBe(source.cropScale);
		expect(resized).toMatchObject({ imageX: -140, imageY: -50, imageWidth: 560, imageHeight: 200 });
	});

	it("uses pointer-down geometry for cumulative live resize", () => {
		const source = image();
		setFixture([source]);
		imageAssetState.set({
			asset: {
				id: "asset",
				projectId: "prod",
				name: "image.png",
				mimeType: "image/png",
				dataUrl: "data:image/png;base64,AA==",
				width: 400,
				height: 200
			}
		});
		canvasState.set({ width: 600, height: 300, color: "#fff", x: 0, y: 0, camera: { x: 0, y: 0, zoom: 1 } });

		for (let totalDx = 1; totalDx <= 300; totalDx += 1) {
			resizeElementByHandle(source.id, "e", totalDx, 0, undefined, source);
		}

		expect(get(projectState).elements[0]).toMatchObject({
			width: 500,
			imageX: -250,
			imageY: -50,
			imageWidth: 1000,
			imageHeight: 200
		});
	});

	it("retains the frame and crop aspect ratios during Shift-resize", () => {
		const source = image();
		setFixture([source]);
		imageAssetState.set({
			asset: {
				id: "asset",
				projectId: "prod",
				name: "image.png",
				mimeType: "image/png",
				dataUrl: "data:image/png;base64,AA==",
				width: 400,
				height: 200
			}
		});
		canvasState.set({ width: 500, height: 300, color: "#fff", x: 0, y: 0, camera: { x: 0, y: 0, zoom: 1 } });

		resizeElementByHandle(
			source.id,
			"e",
			80,
			0,
			{ lockAspectRatio: true, aspectRatio: source.width / source.height },
			source
		);

		const resized = get(projectState).elements[0] as ImageElement;
		expect(resized).toMatchObject({
			x: 50,
			y: 30,
			width: 280,
			height: 140,
			imageX: -140,
			imageY: -70,
			imageWidth: 560,
			imageHeight: 280
		});
		expect(resized.width / resized.height).toBe(source.width / source.height);
		expect((resized.imageWidth ?? 0) / (resized.imageHeight ?? 1)).toBe(2);
	});

	it("uses the same image scaling for numeric size updates", () => {
		const source = image();
		setFixture([source]);
		imageAssetState.set({
			asset: {
				id: "asset",
				projectId: "prod",
				name: "image.png",
				mimeType: "image/png",
				dataUrl: "data:image/png;base64,AA==",
				width: 400,
				height: 200
			}
		});
		canvasState.set({ width: 500, height: 300, color: "#fff", x: 0, y: 0, camera: { x: 0, y: 0, zoom: 1 } });

		updateElement(source.id, { width: 400 });

		expect(get(projectState).elements[0]).toMatchObject({
			width: 400,
			cropScale: 200,
			imageX: -200,
			imageY: -50,
			imageWidth: 800,
			imageHeight: 200
		});
	});

	it("applies generic crop scale patches to the explicit image rectangle", () => {
		const source = image();
		setFixture([source]);
		imageAssetState.set({
			asset: {
				id: "asset",
				projectId: "prod",
				name: "image.png",
				mimeType: "image/png",
				dataUrl: "data:image/png;base64,AA==",
				width: 400,
				height: 200
			}
		});

		updateElement(source.id, { cropScale: 400 });

		expect(get(projectState).elements[0]).toMatchObject({
			cropScale: 400,
			imageX: -300,
			imageY: -150,
			imageWidth: 800,
			imageHeight: 400
		});
	});

	it("re-derives the image rectangle for generic crop offset patches", () => {
		const source = image();
		setFixture([{ ...source, imageX: -100, imageY: -50, imageWidth: 400, imageHeight: 200 }]);
		imageAssetState.set({
			asset: {
				id: "asset",
				projectId: "prod",
				name: "image.png",
				mimeType: "image/png",
				dataUrl: "data:image/png;base64,AA==",
				width: 400,
				height: 200
			}
		});

		updateElement(source.id, { cropX: 100 });

		expect(get(projectState).elements[0]).toMatchObject({ cropX: 100, imageX: -200, imageWidth: 400 });
	});

	it("does not persist image geometry for assetless placeholders", () => {
		const source = { ...image(), assetId: null };
		setFixture([source]);
		imageAssetState.set({});
		canvasState.set({ width: 500, height: 300, color: "#fff", x: 0, y: 0, camera: { x: 0, y: 0, zoom: 1 } });

		resizeElementByHandle(source.id, "e", 80, 0);

		expect(get(projectState).elements[0]).toEqual({ ...source, width: 280 });
	});
});
