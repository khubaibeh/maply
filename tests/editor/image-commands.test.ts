import type { ImageElement, StoredImageAsset } from "@maply/model/types";
import { resizeImageCropFrame, setImageCropScale, translateImageCrop } from "editor/image/commands";
import { imageAssetState } from "editor/state/assets";
import { projectState, updateProjectState } from "editor/state/document";
import { canvasState } from "editor/state/workspace";
import { get } from "svelte/store";
import { describe, expect, it } from "vitest";

function image(): ImageElement {
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
		cropScale: 200
	};
}

const asset: StoredImageAsset = {
	id: "asset",
	projectId: "prod",
	name: "image.png",
	mimeType: "image/png",
	dataUrl: "data:image/png;base64,AA==",
	width: 400,
	height: 200
};

function setFixture(): ImageElement {
	const element = image();
	canvasState.set({ width: 800, height: 600, color: "#fff", x: 0, y: 0, camera: { x: 0, y: 0, zoom: 1 } });
	updateProjectState((state) => ({ ...state, elements: [element] }), "rescan");
	imageAssetState.set({ asset });
	return element;
}

describe("resizeImageCropFrame", () => {
	it("keeps the image fixed while enforcing the minimum frame size", () => {
		const source = setFixture();

		resizeImageCropFrame(source.id, "w", 198, 0, undefined, source);

		const resized = get(projectState).elements[0] as ImageElement;
		expect(resized.width).toBe(5);
		expect(resized.x).toBe(295);
		expect(resized.cropScale).toBe(200);
		expect(resized.x + (resized.imageX ?? 0)).toBe(-20);
		expect(resized.imageWidth).toBe(400);
	});

	it("stops an expanding crop frame at the finite image boundary", () => {
		const source = setFixture();

		resizeImageCropFrame(source.id, "e", 1000, 0, undefined, source);

		const resized = get(projectState).elements[0] as ImageElement;
		expect(resized.width).toBe(280);
		expect(resized.x + resized.width).toBe(380);
		expect(resized.imageX).toBe(-120);
		expect(resized.imageWidth).toBe(400);
		expect(resized.cropScale).toBe(source.cropScale);
	});

	it("uses the pointer-down image snapshot for repeated pointer movement", () => {
		const source = setFixture();
		resizeImageCropFrame(source.id, "se", 10, 10, undefined, source);
		resizeImageCropFrame(source.id, "se", 30, 30, undefined, source);
		const repeated = get(projectState).elements[0];

		setFixture();
		resizeImageCropFrame(source.id, "se", 30, 30, undefined, source);
		expect(get(projectState).elements[0]).toEqual(repeated);
	});
});

describe("image crop transform", () => {
	it("pans to the image boundary without changing zoom", () => {
		const source = setFixture();

		translateImageCrop(source.id, 1000, 1000);

		const moved = get(projectState).elements[0] as ImageElement;
		expect(moved).toMatchObject({ imageX: 0, imageY: 0, imageWidth: 400, imageHeight: 200, cropScale: 200 });
	});

	it("changes image dimensions when the zoom control changes", () => {
		const source = setFixture();

		setImageCropScale(source.id, 400);

		const zoomed = get(projectState).elements[0] as ImageElement;
		expect(zoomed).toMatchObject({ imageX: -340, imageY: -140, imageWidth: 800, imageHeight: 400, cropScale: 400 });
	});
});
