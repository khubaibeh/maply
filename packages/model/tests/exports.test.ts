import {
	createDefaultProject,
	createSampleProject,
	defaultProject,
	drawingTools,
	getImageRenderRect,
	getLegacyImageRenderRect,
	hasValidImageRect,
	hexColorPattern,
	isDrawingTool,
	isPointInsideCanvas,
	parseHexColor,
	parseIntNumber,
	parseNonNegativeNumber,
	parsePositiveInt
} from "@maply/model";
import {
	CameraSchema,
	CanvasSchema,
	CircleElementSchema,
	ElementSchema,
	ElementTypeSchema,
	ImageElementSchema,
	PathElementSchema,
	PointSchema,
	ProjectSchema,
	RectElementSchema,
	StoredImageAssetSchema,
	TextElementSchema,
	ToolSchema
} from "@maply/model/effect";
import type {
	Camera,
	Canvas,
	CircleElement,
	Element,
	ElementType,
	ImageElement,
	PathElement,
	Point,
	Project,
	RectElement,
	StoredImageAsset,
	TextElement,
	Tool
} from "@maply/model/types";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

const decodeProject = Schema.decodeUnknownSync(ProjectSchema);
const decodeElement = Schema.decodeUnknownSync(ElementSchema);

describe("@maply/model exports", () => {
	it("exposes project defaults", () => {
		expect(defaultProject.id).toBe("prod");
		expect(createDefaultProject("next").id).toBe("next");
		expect(createSampleProject().elements.length).toBeGreaterThan(0);
	});

	it("exposes tool helpers", () => {
		expect(drawingTools).toContain("rect");
		expect(isDrawingTool("rect")).toBe(true);
		expect(isDrawingTool("select")).toBe(false);
	});

	it("exposes geometry helpers", () => {
		expect(isPointInsideCanvas({ x: 1, y: 1 }, { x: 0, y: 0, width: 2, height: 2, color: "#ffffff" })).toBe(true);
	});

	it("exposes validation helpers", () => {
		expect(hexColorPattern.test("#ffffff")).toBe(true);
		expect(parseHexColor(" #000 ")).toBe("#000");
		expect(parseIntNumber("1.6")).toBe(2);
		expect(parsePositiveInt("2")).toBe(2);
		expect(parseNonNegativeNumber("2.4")).toBe(2);
	});

	it("exposes model types", () => {
		const canvas: Canvas = { width: 1, height: 1, color: "#ffffff", x: 0, y: 0 };
		const camera: Camera = { x: 0, y: 0, zoom: 1 };
		const point: Point = { x: 0, y: 0 };
		const asset: StoredImageAsset = {
			id: "asset",
			projectId: "project",
			name: "asset",
			mimeType: "image/png",
			dataUrl: "data:image/png;base64,",
			width: 1,
			height: 1
		};
		const rect: RectElement = {
			id: "rect",
			name: "rect",
			type: "rect",
			x: 0,
			y: 0,
			width: 1,
			height: 1,
			fill: "#ffffff",
			stroke: "#000000",
			strokeWidth: 0
		};
		const circle: CircleElement = {
			id: "circle",
			name: "circle",
			type: "circle",
			cx: 0,
			cy: 0,
			r: 1,
			fill: "#ffffff",
			stroke: "#000000",
			strokeWidth: 0
		};
		const path: PathElement = {
			id: "path",
			name: "path",
			type: "path",
			x: 0,
			y: 0,
			d: "M0,0 L1,1",
			fill: "#ffffff",
			stroke: "#000000",
			strokeWidth: 0,
			closed: false
		};
		const text: TextElement = {
			id: "text",
			name: "text",
			type: "text",
			x: 0,
			y: 0,
			width: 1,
			height: 1,
			text: "text",
			fontSize: 12,
			fill: "#000000"
		};
		const image: ImageElement = {
			id: "image",
			name: "image",
			type: "image",
			x: 0,
			y: 0,
			width: 1,
			height: 1,
			assetId: asset.id,
			cropX: 0,
			cropY: 0,
			cropScale: 1
		};
		const elements: Element[] = [rect, circle, path, text, image];
		const project: Project = { id: "project", name: "project", canvas, camera, elements };
		const tool: Tool = "select";
		const elementType: ElementType = rect.type;

		expect({ elementType, point, project, tool }).toBeTruthy();
	});

	it("exposes Effect schemas", () => {
		type ProjectFromSchema = typeof ProjectSchema.Type;
		const project: ProjectFromSchema = decodeProject(createDefaultProject("effect"));

		expect(project.id).toBe("effect");
		expect(Schema.decodeUnknownSync(ToolSchema)("select")).toBe("select");
		expect(Schema.decodeUnknownSync(ToolSchema)("hand")).toBe("hand");
		expect(Schema.decodeUnknownSync(ElementTypeSchema)("rect")).toBe("rect");
		expect([
			CameraSchema,
			CanvasSchema,
			CircleElementSchema,
			ElementSchema,
			ImageElementSchema,
			PathElementSchema,
			PointSchema,
			RectElementSchema,
			StoredImageAssetSchema,
			TextElementSchema
		]).toHaveLength(10);
	});

	it("exposes shared image render geometry", () => {
		const image: ImageElement = {
			id: "image",
			name: "image",
			type: "image",
			x: 0,
			y: 0,
			width: 200,
			height: 100,
			assetId: "asset",
			cropX: 0,
			cropY: 0,
			cropScale: 200
		};
		const asset = { width: 400, height: 200 };

		expect(getLegacyImageRenderRect(image, asset)).toEqual({ x: -100, y: -50, width: 400, height: 200 });
		expect(
			getImageRenderRect({ ...image, imageX: -20, imageY: -10, imageWidth: 240, imageHeight: 120 }, asset)
		).toEqual({
			x: -20,
			y: -10,
			width: 240,
			height: 120
		});
		expect(hasValidImageRect({ ...image, imageX: -20, imageY: -10, imageWidth: 240, imageHeight: 120 })).toBe(true);
		expect(hasValidImageRect({ ...image, imageX: -20, imageY: -10, imageWidth: 0, imageHeight: 120 })).toBe(false);
	});

	it("rejects invalid model payloads", () => {
		expect(() => decodeElement({ id: "bad", name: "bad", type: "triangle" })).toThrow();
		expect(() => {
			decodeProject({
				...createDefaultProject("missing-canvas"),
				canvas: undefined
			});
		}).toThrow();
		expect(() => {
			decodeElement({
				id: "image",
				name: "image",
				type: "image",
				x: 0,
				y: 0,
				width: 1,
				height: 1,
				assetId: 1,
				cropX: 0,
				cropY: 0,
				cropScale: 1
			});
		}).toThrow();
	});
});
