import type { Element, ImageElement } from "@maply/model/types";
import { copy, paste } from "editor/compat/clipboard";
import { getElementBounds, getImageRenderRect } from "editor/compat/geometry";
import { resizeImageCropFrame } from "editor/compat/image";
import { normalizeElement } from "editor/compat/normalize";
import { exportProject } from "editor/compat/project";
import { importExportState } from "editor/compat/project-state";
import { getWrappedTextLines } from "editor/compat/text";
import { replaceImageAsset } from "editor/compat/upload";
import { imageAssetState } from "editor/state/assets";
import { projectState } from "editor/state/document";
import { canvasState } from "editor/state/workspace";
import { get } from "svelte/store";
import { describe, expect, it } from "vitest";

describe("legacy element compatibility", () => {
	it("includes cubic curve extrema in path bounds", () => {
		const path: Element = {
			id: "path",
			name: "Path",
			type: "path",
			x: 10,
			y: 10,
			d: "M0,0 C0,100 100,100 100,0",
			fill: "none",
			stroke: "#000",
			strokeWidth: 2,
			closed: false
		};
		const bounds = getElementBounds(path);
		expect(bounds.width).toBe(102);
		expect(bounds.height).toBe(77);
	});

	it.each([
		["quadratic", "M0,0 Q50,100 100,0"],
		["smooth quadratic", "M0,0 Q25,100 50,0 T100,0"],
		["smooth cubic", "M0,0 C0,100 50,100 50,0 S100,-100 100,0"],
		["arc", "M0,0 A40,20 0 0,1 100,0"]
	])("includes %s commands in path bounds", (_name, d) => {
		const bounds = getElementBounds(pathElement(d));
		expect(bounds.width).toBeGreaterThan(2);
		expect(bounds.height).toBeGreaterThan(2);
	});

	it("uses rendered glyph bearings and preserves explicit multiline text", () => {
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
		const text: Element = {
			id: "text",
			name: "Text",
			type: "text",
			x: 100,
			y: 100,
			width: 200,
			height: 60,
			text: "first\nsecond",
			fontSize: 16,
			fill: "#000"
		};
		expect(getElementBounds(text)).toMatchObject({ x: 97, y: 82 });
		expect(getWrappedTextLines(text)).toEqual(["first", "second"]);
		Object.defineProperty(globalThis, "document", { configurable: true, value: previousDocument });
	});

	it("normalizes legacy image crop fields", () => {
		const image = {
			id: "image",
			name: "Image",
			type: "image",
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			assetId: undefined,
			cropX: 200,
			cropY: undefined,
			cropScale: 50
		} as unknown as Element;

		expect(normalizeElement(image)).toMatchObject({ assetId: null, cropX: 100, cropY: 0, cropScale: 100 });
	});

	it("preserves rendered image position and the legacy minimum frame size", () => {
		const image: ImageElement = {
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
		const asset = {
			id: "asset",
			projectId: "prod",
			name: "image.png",
			mimeType: "image/png",
			dataUrl: "data:image/png;base64,AA==",
			width: 400,
			height: 200
		};

		canvasState.set({ width: 800, height: 600, color: "#fff", x: 0, y: 0, camera: { x: 0, y: 0, zoom: 1 } });
		projectState.update((state) => ({ ...state, elements: [image] }));
		imageAssetState.set({ asset });
		const before = getImageRenderRect({ ...image, assetWidth: asset.width, assetHeight: asset.height });

		resizeImageCropFrame(image.id, "w", 198, 0, undefined, image);

		const resized = get(projectState).elements[0] as ImageElement;
		const after = getImageRenderRect({ ...resized, assetWidth: asset.width, assetHeight: asset.height });
		expect(resized.width).toBe(5);
		expect(Math.abs(after.x - before.x)).toBeLessThanOrEqual(1);
		expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(1);
	});

	it.each(["n", "s", "e", "w", "ne", "nw", "se", "sw"] as const)(
		"preserves crop content while resizing from %s",
		(handle) => {
			const { image, asset } = setCropFixture();
			const before = getImageRenderRect({ ...image, assetWidth: asset.width, assetHeight: asset.height });
			const dx = handle.includes("w") ? 10 : handle.includes("e") ? -10 : 0;
			const dy = handle.includes("n") ? 10 : handle.includes("s") ? -10 : 0;
			resizeImageCropFrame(image.id, handle, dx, dy, undefined, image);
			const resized = get(projectState).elements[0] as ImageElement;
			const after = getImageRenderRect({ ...resized, assetWidth: asset.width, assetHeight: asset.height });
			expect(Math.abs(after.x - before.x)).toBeLessThanOrEqual(1);
			expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(1);
		}
	);

	it("clamps crop resize at canvas edges", () => {
		const { image } = setCropFixture();
		resizeImageCropFrame(image.id, "nw", -1000, -1000, undefined, image);
		const resized = get(projectState).elements[0] as ImageElement;
		expect(resized.x).toBeGreaterThanOrEqual(0);
		expect(resized.y).toBeGreaterThanOrEqual(0);
		expect(resized.x + resized.width).toBeLessThanOrEqual(800);
		expect(resized.y + resized.height).toBeLessThanOrEqual(600);
	});

	it("uses the original crop snapshot for repeated pointer movement", () => {
		const { image } = setCropFixture();
		resizeImageCropFrame(image.id, "se", 10, 10, undefined, image);
		resizeImageCropFrame(image.id, "se", 30, 30, undefined, image);
		const repeated = get(projectState).elements[0];
		setCropFixture();
		resizeImageCropFrame(image.id, "se", 30, 30, undefined, image);
		expect(get(projectState).elements[0]).toEqual(repeated);
	});

	it("derives pasted names from the source name", async () => {
		const rect: Element = {
			id: "rect",
			name: "company-logo",
			type: "rect",
			x: 10,
			y: 10,
			width: 20,
			height: 20,
			fill: "#000",
			stroke: "#000",
			strokeWidth: 0
		};
		projectState.update((state) => ({ ...state, elements: [rect] }));
		copy([rect]);

		await paste();

		expect(get(projectState).elements.at(-1)?.name).toBe("company-logo-copy");
	});

	it("uniquely names multi-element paste from source names", async () => {
		const rect = rectElement("rect", "logo", 10, 10);
		projectState.update((state) => ({ ...state, elements: [rect] }));
		copy([rect, { ...rect, id: "rect-2" }]);
		await paste();
		expect(
			get(projectState)
				.elements.slice(-2)
				.map((element) => element.name)
		).toEqual(["logo-copy", "logo-copy-2"]);
	});

	it("drops missing image references during paste", async () => {
		const image = cropImage({ assetId: "missing" });
		projectState.update((state) => ({ ...state, elements: [image] }));
		imageAssetState.set({});
		copy([image]);
		await paste();
		expect(get(projectState).elements.at(-1)).toMatchObject({ type: "image", assetId: null });
	});

	it("positions context-menu paste at the requested point", async () => {
		const rect = rectElement("rect", "rect", 10, 10);
		projectState.update((state) => ({ ...state, elements: [rect] }));
		copy([rect]);
		await paste({ x: 300, y: 250 });
		expect(getElementBounds(get(projectState).elements.at(-1)!)).toMatchObject({ x: 300, y: 250 });
	});

	it("does not publish replacement state when IndexedDB fails", async () => {
		const image = cropImage({ assetId: null });
		const replacement = imageAsset("replacement");
		projectState.update((state) => ({ ...state, elements: [image] }));
		imageAssetState.set({});
		const before = structuredClone(get(projectState));
		const restore = failIndexedDbOpen();
		const result = await replaceImageAsset(image.id, replacement);
		restore();
		expect(result.ok).toBe(false);
		expect(get(projectState)).toEqual(before);
		expect(get(imageAssetState)).toEqual({});
	});

	it("does not insert pasted images when cloned asset persistence fails", async () => {
		const image = cropImage({ assetId: "source" });
		projectState.update((state) => ({ ...state, elements: [image] }));
		imageAssetState.set({ source: imageAsset("source") });
		copy([image]);
		const restore = failIndexedDbOpen();
		await paste();
		restore();
		expect(get(projectState).elements).toEqual([image]);
	});

	it("preserves legacy import/export panel state in project exports", async () => {
		projectState.update((state) => ({ ...state, elements: [] }));
		importExportState.set({ importsOpen: false, elementsOpen: false });
		imageAssetState.set({});

		const result = await exportProject();

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.project.importExportState).toEqual({ importsOpen: false, elementsOpen: false });
		}
	});
});

function pathElement(d: string): Element {
	return {
		id: "path",
		name: "Path",
		type: "path",
		x: 0,
		y: 0,
		d,
		fill: "none",
		stroke: "#000",
		strokeWidth: 2,
		closed: false
	};
}

function rectElement(id: string, name: string, x: number, y: number): Element {
	return { id, name, type: "rect", x, y, width: 20, height: 20, fill: "#000", stroke: "#000", strokeWidth: 0 };
}

function cropImage(overrides: Partial<ImageElement> = {}): ImageElement {
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

function imageAsset(id: string) {
	return {
		id,
		projectId: "prod",
		name: `${id}.png`,
		mimeType: "image/png",
		dataUrl: "data:image/png;base64,AA==",
		width: 400,
		height: 200
	};
}

function setCropFixture() {
	const image = cropImage();
	const asset = imageAsset("asset");
	canvasState.set({ width: 800, height: 600, color: "#fff", x: 0, y: 0, camera: { x: 0, y: 0, zoom: 1 } });
	projectState.update((state) => ({ ...state, elements: [image] }));
	imageAssetState.set({ asset });
	return { image, asset };
}

function failIndexedDbOpen(): () => void {
	const current = globalThis.indexedDB;
	Object.defineProperty(globalThis, "indexedDB", {
		configurable: true,
		value: {
			open: () => {
				throw new Error("Injected IndexedDB failure");
			}
		}
	});
	return () => Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: current });
}
