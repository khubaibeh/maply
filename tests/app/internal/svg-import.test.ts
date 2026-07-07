import { createDefaultProject } from "@app/domain/defaults";
import { buildSvgExport } from "@app/internal/svg-export";
import { parseSvgProjectFilePackage } from "@app/internal/svg-import";
import { describe, expect, it } from "vitest";

describe("parseSvgProjectFilePackage", () => {
	it("reconstructs a project package from Maply SVG exports", () => {
		const project = createDefaultProject("prod");
		project.canvas.width = 640;
		project.canvas.height = 480;
		project.elements = [
			{
				id: "rect-1",
				name: "Rect",
				type: "rect",
				x: 10,
				y: 20,
				width: 30,
				height: 40,
				fill: "#111111",
				stroke: "#000000",
				strokeWidth: 0
			},
			{
				id: "image-1",
				name: "Photo",
				type: "image",
				x: 50,
				y: 60,
				width: 100,
				height: 80,
				assetId: "asset-1",
				cropX: 10,
				cropY: -10,
				cropScale: 120
			}
		];

		const svg = buildSvgExport(project, [
			{
				id: "asset-1",
				projectId: "prod",
				name: "asset-1.png",
				mimeType: "image/png",
				dataUrl: "data:image/png;base64,abc",
				width: 200,
				height: 100
			}
		]);

		const parsed = parseSvgProjectFilePackage(svg);

		expect(parsed.project).toEqual(project);
		expect(parsed.imageAssets).toEqual([
			{
				id: "asset-1",
				projectId: "prod",
				name: "asset-1.png",
				mimeType: "image/png",
				dataUrl: "data:image/png;base64,abc",
				width: 200,
				height: 100
			}
		]);
	});

	it("rejects SVG without Maply recovery metadata", () => {
		expect(() => parseSvgProjectFilePackage('<svg xmlns="http://www.w3.org/2000/svg"></svg>')).toThrow(
			/Maply recovery metadata/i
		);
	});

	it("rejects SVG when an exported asset data url is missing", () => {
		const project = createDefaultProject("prod");
		project.elements = [
			{
				id: "image-1",
				name: "Photo",
				type: "image",
				x: 10,
				y: 20,
				width: 100,
				height: 80,
				assetId: "asset-1",
				cropX: 0,
				cropY: 0,
				cropScale: 100
			}
		];

		const svg = buildSvgExport(project, [
			{
				id: "asset-1",
				projectId: "prod",
				name: "asset-1.png",
				mimeType: "image/png",
				dataUrl: "data:image/png;base64,abc",
				width: 200,
				height: 100
			}
		]).replace(/<image\b[^>]*data-maply-asset-id="asset-1"[^>]*>/i, "");

		expect(() => parseSvgProjectFilePackage(svg)).toThrow(/missing embedded image asset asset-1/i);
	});
});
