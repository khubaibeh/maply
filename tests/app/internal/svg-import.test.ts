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

	it("imports Synoptic SVG polygons and background image", () => {
		const parsed = parseSvgProjectFilePackage(
			[
				'<svg id="Map" class="gen-by-synoptic-designer" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 120 80">',
				'<image width="120" height="80" xlink:href="data:image/png;base64,abc" />',
				'<polygon id="1-227" title="Vestibule" points="10,10,50,10,50,30,10,30" />',
				'<polygon id="1-225" title="Material Search" points="60,20,90,20,90,50,60,50" />',
				"</svg>"
			].join("")
		);

		expect(parsed.project.name).toBe("Map");
		expect(parsed.project.canvas).toMatchObject({ width: 120, height: 80, x: 0, y: 0 });
		expect(parsed.imageAssets).toEqual([
			{
				id: expect.any(String),
				projectId: "prod",
				name: "floorplan.png",
				mimeType: "image/png",
				dataUrl: "data:image/png;base64,abc",
				width: 120,
				height: 80
			}
		]);
		expect(parsed.project.elements).toEqual([
			{
				id: expect.any(String),
				name: "floorplan",
				type: "image",
				x: 0,
				y: 0,
				width: 120,
				height: 80,
				assetId: parsed.imageAssets[0]?.id ?? "",
				href: undefined,
				cropX: 0,
				cropY: 0,
				cropScale: 100
			},
			{
				id: "1-227",
				name: "1-227",
				type: "path",
				x: 10,
				y: 10,
				d: "M10,10 L50,10 L50,30 L10,30 Z",
				fill: "#000000",
				stroke: "none",
				strokeWidth: 0,
				closed: true
			},
			{
				id: "1-225",
				name: "1-225",
				type: "path",
				x: 60,
				y: 20,
				d: "M60,20 L90,20 L90,50 L60,50 Z",
				fill: "#000000",
				stroke: "none",
				strokeWidth: 0,
				closed: true
			}
		]);
	});

	it("imports Synoptic rect, circle, path, and text elements", () => {
		const parsed = parseSvgProjectFilePackage(
			[
				'<svg class="gen-by-synoptic-designer" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">',
				'<rect id="rect-1" title="Desk" x="10" y="20" width="30" height="40" />',
				'<circle id="circle-1" title="Node" cx="100" cy="120" r="15" />',
				'<path id="path-1" title="Route" d="M150,10 L180,10 L180,40 Z" />',
				'<text id="text-1" title="Label" x="20" y="160" font-size="18">Hello</text>',
				"</svg>"
			].join("")
		);

		expect(parsed.project.elements).toEqual([
			{
				id: "rect-1",
				name: "rect-1",
				type: "rect",
				x: 10,
				y: 20,
				width: 30,
				height: 40,
				fill: "#000000",
				stroke: "none",
				strokeWidth: 0
			},
			{
				id: "circle-1",
				name: "circle-1",
				type: "circle",
				cx: 100,
				cy: 120,
				r: 15,
				fill: "#000000",
				stroke: "none",
				strokeWidth: 0
			},
			{
				id: "path-1",
				name: "path-1",
				type: "path",
				x: 150,
				y: 10,
				d: "M150,10 L180,10 L180,40 Z",
				fill: "#000000",
				stroke: "none",
				strokeWidth: 0,
				closed: true
			},
			{
				id: "text-1",
				name: "text-1",
				type: "text",
				x: 20,
				y: 160,
				width: 54,
				height: 22,
				text: "Hello",
				fontSize: 18,
				fill: "#000000"
			}
		]);
	});

	it("normalizes non-zero Synoptic viewBox origins", () => {
		const parsed = parseSvgProjectFilePackage(
			[
				'<svg class="gen-by-synoptic-designer" xmlns="http://www.w3.org/2000/svg" viewBox="100 200 120 80">',
				'<polygon id="room" title="Room" points="110,210,130,210,130,230,110,230" />',
				"</svg>"
			].join("")
		);

		expect(parsed.project.canvas).toMatchObject({ width: 120, height: 80, x: 0, y: 0 });
		expect(parsed.project.elements[0]).toMatchObject({
			id: "room",
			name: "room",
			x: 10,
			y: 10,
			d: "M10,10 L30,10 L30,30 L10,30 Z"
		});
	});

	it("deduplicates repeated Synoptic SVG element ids", () => {
		const parsed = parseSvgProjectFilePackage(
			[
				'<svg class="gen-by-synoptic-designer" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80">',
				'<image id="room" width="120" height="80" href="data:image/png;base64,abc" />',
				'<rect id="room" title="Room A" x="10" y="10" width="20" height="20" />',
				'<polygon id="room" title="Room B" points="40,10,60,10,60,30,40,30" />',
				"</svg>"
			].join("")
		);

		const ids = parsed.project.elements.map((element) => element.id);
		expect(new Set(ids).size).toBe(ids.length);
		expect(ids[0]).toBe("room");
		expect(ids.slice(1)).not.toContain("room");
		expect(parsed.project.elements[0]).toMatchObject({ type: "image", assetId: parsed.imageAssets[0]?.id });
	});

	it("sizes the Synoptic canvas from imported content bounds", () => {
		const parsed = parseSvgProjectFilePackage(
			[
				'<svg class="gen-by-synoptic-designer" xmlns="http://www.w3.org/2000/svg">',
				'<rect id="rect-1" title="Desk" x="40" y="50" width="30" height="20" />',
				'<circle id="circle-1" title="Node" cx="100" cy="110" r="10" />',
				"</svg>"
			].join("")
		);

		expect(parsed.project.canvas).toMatchObject({ width: 70, height: 70, x: 0, y: 0 });
		expect(parsed.project.elements).toEqual([
			{
				id: "rect-1",
				name: "rect-1",
				type: "rect",
				x: 0,
				y: 0,
				width: 30,
				height: 20,
				fill: "#000000",
				stroke: "none",
				strokeWidth: 0
			},
			{
				id: "circle-1",
				name: "circle-1",
				type: "circle",
				cx: 60,
				cy: 60,
				r: 10,
				fill: "#000000",
				stroke: "none",
				strokeWidth: 0
			}
		]);
	});

	it("drops Synoptic elements outside a declared canvas", () => {
		const parsed = parseSvgProjectFilePackage(
			[
				'<svg class="gen-by-synoptic-designer" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">',
				'<rect id="inside" x="10" y="10" width="20" height="20" />',
				'<rect id="outside" x="90" y="90" width="20" height="20" />',
				'<circle id="negative" cx="5" cy="5" r="10" />',
				"</svg>"
			].join("")
		);

		expect(parsed.project.canvas).toMatchObject({ width: 100, height: 100, x: 0, y: 0 });
		expect(parsed.project.elements).toEqual([
			{
				id: "inside",
				name: "inside",
				type: "rect",
				x: 10,
				y: 10,
				width: 20,
				height: 20,
				fill: "#000000",
				stroke: "none",
				strokeWidth: 0
			}
		]);
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
