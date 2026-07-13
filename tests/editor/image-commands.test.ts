import type { ImageElement, StoredImageAsset } from "@maply/model/types";
import { resizeImageCropFrame } from "editor/image/commands";
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
	it("preserves rendered crop content while enforcing the legacy minimum frame size", () => {
		const source = setFixture();

		resizeImageCropFrame(source.id, "w", 198, 0, undefined, source);

		const resized = get(projectState).elements[0] as ImageElement;
		expect(resized.width).toBe(5);
		expect(resized.x).toBe(295);
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
