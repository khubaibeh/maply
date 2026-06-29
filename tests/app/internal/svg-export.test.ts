import { createDefaultProject } from "@app/domain/defaults";
import type { StoredImageAsset } from "@app/domain/image-assets";
import { buildMetadata, buildSvgExport } from "@app/internal/svg-export";
import { describe, expect, it } from "vitest";

function createAsset(id: string): StoredImageAsset {
	return {
		id,
		projectId: "prod",
		name: `${id}.png`,
		mimeType: "image/png",
		dataUrl: "data:image/png;base64,abc",
		width: 200,
		height: 100
	};
}

describe("buildSvgExport", () => {
	it("preserves root size and background color", () => {
		const project = createDefaultProject("prod");
		project.canvas.width = 640;
		project.canvas.height = 480;
		project.canvas.color = "#abcdef";
		project.elements = [];

		const svg = buildSvgExport(project, [], { embeddedFontCss: "@font-face{}" });

		expect(svg).toContain('width="640"');
		expect(svg).toContain('height="480"');
		expect(svg).toContain('viewBox="0 0 640 480"');
		expect(svg).toContain('fill="#abcdef"');
	});

	it("preserves project layer order", () => {
		const project = createDefaultProject("prod");
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
				id: "circle-1",
				name: "Circle",
				type: "circle",
				cx: 80,
				cy: 90,
				r: 10,
				fill: "#222222",
				stroke: "#000000",
				strokeWidth: 0
			}
		];

		const svg = buildSvgExport(project, []);
		const rectIndex = svg.indexOf('<rect id="Rect" x="10" y="20"');
		const circleIndex = svg.indexOf('<circle id="Circle" cx="80" cy="90"');

		expect(rectIndex).toBeGreaterThan(-1);
		expect(circleIndex).toBeGreaterThan(rectIndex);
		expect(svg).toContain('id="Rect"');
		expect(svg).toContain('id="Circle"');
	});

	it("embeds font css and recovery metadata", () => {
		const project = createDefaultProject("prod");
		project.elements = [
			{
				id: "text-1",
				name: "Title",
				type: "text",
				x: 10,
				y: 20,
				width: 120,
				height: 40,
				text: "Maply",
				fontSize: 24,
				fill: "#000000"
			}
		];

		const svg = buildSvgExport(project, [], { embeddedFontCss: "@font-face { font-family: test; }" });

		expect(svg).toContain("@font-face");
		expect(svg).toContain("maply-recovery");
		expect(svg).toContain("Maply Export Inter");
		expect(svg).toContain("<text ");
	});

	it("embeds asset-backed images and recovery ids without duplicating dataUrl in metadata", () => {
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

		const asset = createAsset("asset-1");
		const svg = buildSvgExport(project, [asset]);
		const metadata = buildMetadata(project, [asset]);

		expect(svg).toContain('data-maply-asset-id="asset-1"');
		expect(svg).toContain('href="data:image/png;base64,abc"');
		expect(svg).toContain('viewBox="0 0 100 80" overflow="hidden"');
		expect(JSON.stringify(metadata)).not.toContain("data:image/png;base64,abc");
		expect(JSON.stringify(metadata)).not.toContain("dataUrl");
	});

	it("normalizes canvas offsets into exported artboard coordinates", () => {
		const project = createDefaultProject("prod");
		project.canvas.x = 50;
		project.canvas.y = 30;
		project.elements = [
			{
				id: "rect-1",
				name: "Rect",
				type: "rect",
				x: 70,
				y: 45,
				width: 20,
				height: 10,
				fill: "#111111",
				stroke: "#000000",
				strokeWidth: 0
			}
		];

		const svg = buildSvgExport(project, []);

		expect(svg).toContain('<rect id="Rect" x="20" y="15" width="20" height="10" fill="#111111"');
	});
});
