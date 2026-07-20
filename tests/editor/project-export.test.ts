import { project as projectIo } from "@maply/io";
import type { ImageElement, StoredImageAsset } from "@maply/model/types";
import { exportProject } from "editor/project/export";
import { exportSvg } from "editor/project/svg";
import { imageAssetState } from "editor/state/assets";
import { updateProjectState } from "editor/state/document";
import { canvasState } from "editor/state/workspace";
import { describe, expect, it } from "vitest";

const image: ImageElement = {
	id: "image",
	name: "Image",
	type: "image",
	x: 10,
	y: 20,
	width: 200,
	height: 100,
	assetId: "asset",
	href: undefined,
	cropX: 0,
	cropY: 0,
	cropScale: 200,
	imageX: -100,
	imageY: -50,
	imageWidth: 400,
	imageHeight: 200
};

const asset: StoredImageAsset = {
	id: "asset",
	projectId: "prod",
	name: "image.png",
	mimeType: "image/png",
	dataUrl: "data:image/png;base64,AA==",
	width: 400,
	height: 200
};

function setFixture() {
	canvasState.set({ width: 800, height: 600, color: "#fff", x: 0, y: 0, camera: { x: 0, y: 0, zoom: 1 } });
	updateProjectState((state) => ({ ...state, id: "prod", name: "Export", elements: [image] }), "rescan");
	imageAssetState.set({ asset });
}

describe("project export", () => {
	it("serializes projects with explicit image geometry", async () => {
		setFixture();
		const file = await exportProject();
		expect(file.ok).toBe(true);
		if (!file.ok) return;

		const serialized = await projectIo.file.serialize(file.value);
		expect(serialized.ok).toBe(true);
		if (!serialized.ok) return;
		expect(serialized.value).toContain('"imageWidth": 400');
	});

	it("exports SVG with explicit image geometry", async () => {
		setFixture();
		const svg = await exportSvg();
		expect(svg.ok).toBe(true);
		if (!svg.ok) return;
		expect(svg.value).toContain('x="-100" y="-50" width="400" height="200"');
	});
});
