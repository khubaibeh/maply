import { svg as svgIo } from "@maply/io";
import { svg as svgEffect } from "@maply/io/effect";
import { createDefaultProject } from "@maply/model";
import type { Project, StoredImageAsset } from "@maply/model/types";
import { Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";

import { SvgImportWarningType } from "../src/svg/types";

const SYNOPTIC = "gen-by-synoptic-designer";

function synoptic(body: string, attrs = 'viewBox="0 0 200 200"') {
	return `<svg class="${SYNOPTIC}" xmlns="http://www.w3.org/2000/svg" ${attrs}>${body}</svg>`;
}

function importSynoptic(svg: string) {
	return Effect.runSync(svgEffect.import(svg));
}

function asset(id: string): StoredImageAsset {
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

describe("svg export", () => {
	it("renders project artboards and recovery metadata", () => {
		const project: Project = {
			...createDefaultProject("prod"),
			canvas: { ...createDefaultProject("prod").canvas, width: 640, height: 480, color: "#abcdef" },
			elements: []
		};

		const svg = Effect.runSync(svgEffect.export(project, []));

		expect(svg).toContain('width="640"');
		expect(svg).toContain('height="480"');
		expect(svg).toContain('viewBox="0 0 640 480"');
		expect(svg).toContain('fill="#abcdef"');
		expect(svg).toContain('id="maply-recovery"');
	});

	it("embeds image assets but omits data urls from recovery metadata", () => {
		const project: Project = {
			...createDefaultProject("prod"),
			elements: [
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
			]
		};

		const svg = Effect.runSync(svgEffect.export(project, [asset("asset-1")]));
		const metadata = svg.match(/<metadata[^>]*><!\[CDATA\[(.*?)\]\]><\/metadata>/)?.[1] ?? "";

		expect(svg).toContain('data-maply-asset-id="asset-1"');
		expect(svg).toContain('href="data:image/png;base64,abc"');
		expect(metadata).not.toContain("data:image/png;base64,abc");
	});

	it("returns handled root export results", async () => {
		const result = await svgIo.export(createDefaultProject("prod"), []);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value).toContain("<svg");
	});
});

describe("svg recovery import", () => {
	it("round-trips an empty project", () => {
		const project = createDefaultProject("prod");
		const svg = Effect.runSync(svgEffect.export(project, []));
		const imported = Effect.runSync(svgEffect.import(svg));

		expect(imported.source).toBe("recovery");
		expect(imported.warnings).toEqual([]);
		expect(imported.file.project).toEqual(project);
	});

	it("round-trips image assets with crop data", () => {
		const project: Project = {
			...createDefaultProject("prod"),
			elements: [
				{
					id: "image-1",
					name: "Photo",
					type: "image",
					x: 0,
					y: 0,
					width: 100,
					height: 80,
					assetId: "asset-1",
					cropX: 50,
					cropY: -50,
					cropScale: 200
				}
			]
		};

		const svg = Effect.runSync(svgEffect.export(project, [asset("asset-1"), asset("unused")]));
		const imported = Effect.runSync(svgEffect.import(svg));

		expect(imported.source).toBe("recovery");
		expect(imported.file.imageAssets).toHaveLength(1);
		expect(imported.file.imageAssets[0].id).toBe("asset-1");
		expect(imported.file.project.elements[0]).toMatchObject({
			type: "image",
			cropX: 50,
			cropY: -50,
			cropScale: 200
		});
	});

	it("renders and round-trips an explicit image rectangle", () => {
		const project: Project = {
			...createDefaultProject("prod"),
			elements: [
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
					cropScale: 200,
					imageX: -30,
					imageY: -10,
					imageWidth: 180,
					imageHeight: 100
				}
			]
		};

		const svg = Effect.runSync(svgEffect.export(project, [asset("asset-1")]));
		const imported = Effect.runSync(svgEffect.import(svg));

		expect(svg).toContain('<image data-maply-asset-id="asset-1" x="-30" y="-10" width="180" height="100"');
		expect(imported.file.project.elements[0]).toMatchObject({
			imageX: -30,
			imageY: -10,
			imageWidth: 180,
			imageHeight: 100
		});
	});

	it("round-trips multiple element types", () => {
		const project: Project = {
			...createDefaultProject("prod"),
			canvas: { ...createDefaultProject("prod").canvas, width: 500, height: 500 },
			elements: [
				{
					id: "r1",
					name: "rect",
					type: "rect",
					x: 10,
					y: 20,
					width: 100,
					height: 50,
					fill: "#ff0000",
					stroke: "none",
					strokeWidth: 0
				},
				{
					id: "c1",
					name: "circle",
					type: "circle",
					cx: 200,
					cy: 200,
					r: 30,
					fill: "#00ff00",
					stroke: "#000",
					strokeWidth: 2
				},
				{
					id: "p1",
					name: "path",
					type: "path",
					x: 0,
					y: 0,
					d: "M0,0 L50,50 L100,0 Z",
					fill: "#0000ff",
					stroke: "none",
					strokeWidth: 0,
					closed: true
				}
			]
		};

		const svg = Effect.runSync(svgEffect.export(project, []));
		const imported = Effect.runSync(svgEffect.import(svg));

		expect(imported.file.project.elements).toHaveLength(3);
		expect(imported.file.project.elements.map((e) => e.type)).toEqual(["rect", "circle", "path"]);
	});
});

describe("synoptic import - shape types", () => {
	it("falls back to generic SVG when no known format marker exists", () => {
		const imported = importSynoptic(
			'<svg viewBox="0 0 100 100"><rect id="room" x="10" y="20" width="60" height="40" /></svg>'
		);

		expect(imported.source).toBe("generic");
		expect(imported.file.project.elements[0]).toMatchObject({ type: "rect", name: "room" });
		expect(imported.warnings).toContainEqual(
			expect.objectContaining({ type: SvgImportWarningType.GenericFallback })
		);
	});

	it("imports rect elements", () => {
		const imported = importSynoptic(synoptic('<rect id="room" x="10" y="20" width="60" height="40" />'));

		expect(imported.file.project.elements).toHaveLength(1);
		expect(imported.file.project.elements[0]).toMatchObject({
			type: "rect",
			name: "room",
			x: 10,
			y: 20,
			width: 60,
			height: 40
		});
	});

	it("skips rects missing width or height", () => {
		const imported = importSynoptic(
			synoptic('<rect id="bad" x="10" y="20" width="60" /><rect id="ok" x="0" y="0" width="10" height="10" />')
		);

		expect(imported.file.project.elements).toHaveLength(1);
		expect(imported.file.project.elements[0]).toMatchObject({ name: "ok" });
	});

	it("imports circle elements", () => {
		const imported = importSynoptic(synoptic('<circle id="sensor" cx="100" cy="50" r="25" />'));

		expect(imported.file.project.elements).toHaveLength(1);
		expect(imported.file.project.elements[0]).toMatchObject({
			type: "circle",
			name: "sensor",
			cx: 100,
			cy: 50,
			r: 25
		});
	});

	it("skips circles missing required attributes", () => {
		const imported = importSynoptic(
			synoptic('<circle id="bad" cx="100" cy="50" /><rect id="ok" x="0" y="0" width="10" height="10" />')
		);

		expect(imported.file.project.elements).toHaveLength(1);
		expect(imported.file.project.elements[0]).toMatchObject({ name: "ok" });
	});

	it("imports path elements with M/L commands", () => {
		const imported = importSynoptic(synoptic('<path id="wall" d="M10,10 L50,10 L50,40 Z" />'));
		const el = imported.file.project.elements[0];

		expect(el).toMatchObject({ type: "path", name: "wall", closed: true });
		expect(el.type === "path" && el.d).toContain("M");
		expect(el.type === "path" && el.d).toContain("Z");
	});

	it("imports open (non-closed) paths", () => {
		const imported = importSynoptic(synoptic('<path id="line" d="M0,0 L100,100" />'));
		const el = imported.file.project.elements[0];

		expect(el).toMatchObject({ type: "path", closed: false });
		expect(el.type === "path" && el.d).not.toContain("Z");
	});

	it("imports text elements and strips inner tags", () => {
		const imported = importSynoptic(
			synoptic('<text id="label" x="10" y="30" font-size="16"><tspan>Hello</tspan> World</text>')
		);

		expect(imported.file.project.elements).toHaveLength(1);
		expect(imported.file.project.elements[0]).toMatchObject({
			type: "text",
			name: "label",
			x: 10,
			y: 30,
			text: "Hello World",
			fontSize: 16
		});
	});

	it("uses default font size when not specified", () => {
		const imported = importSynoptic(synoptic('<text id="t" x="0" y="0">Test</text>'));

		expect(imported.file.project.elements[0]).toMatchObject({ fontSize: 24 });
	});

	it("skips empty text elements", () => {
		const imported = importSynoptic(
			synoptic('<text id="empty" x="0" y="0">   </text><rect id="ok" x="0" y="0" width="10" height="10" />')
		);

		expect(imported.file.project.elements).toHaveLength(1);
		expect(imported.file.project.elements[0]).toMatchObject({ name: "ok" });
	});

	it("imports polygon elements as closed paths", () => {
		const imported = importSynoptic(synoptic('<polygon id="room" points="10,10 50,10 50,30 10,30" />'));

		expect(imported.file.project.elements).toHaveLength(1);
		expect(imported.file.project.elements[0]).toMatchObject({
			type: "path",
			name: "room",
			closed: true
		});
	});

	it("imports multiple shape types in a single SVG", () => {
		const imported = importSynoptic(
			synoptic(
				'<rect id="r" x="0" y="0" width="20" height="20" />' +
					'<circle id="c" cx="50" cy="50" r="10" />' +
					'<path id="p" d="M60,0 L80,20" />' +
					'<text id="t" x="0" y="100">Hi</text>'
			)
		);

		expect(imported.file.project.elements).toHaveLength(4);
		expect(imported.file.project.elements.map((e) => e.type)).toEqual(["rect", "circle", "path", "text"]);
	});
});

describe("synoptic import - viewBox offset", () => {
	it("translates element coordinates by viewBox origin", () => {
		const imported = importSynoptic(
			synoptic(
				'<rect id="r" x="110" y="220" width="30" height="30" />' + '<circle id="c" cx="150" cy="250" r="10" />',
				'viewBox="100 200 200 200"'
			)
		);

		const rect = imported.file.project.elements.find((e) => e.type === "rect")!;
		const circle = imported.file.project.elements.find((e) => e.type === "circle")!;

		expect(rect).toMatchObject({ x: 10, y: 20 });
		expect(circle).toMatchObject({ type: "circle", cx: 50, cy: 50 });
	});

	it("translates path coordinates by viewBox origin", () => {
		const imported = importSynoptic(
			synoptic('<path id="p" d="M110,210 L150,210 L150,240" />', 'viewBox="100 200 200 200"')
		);

		const path = imported.file.project.elements[0];
		expect(path.type === "path" && path.d).toContain("M10,10");
		expect(path).toMatchObject({ x: 10, y: 10 });
	});

	it("sets canvas size from viewBox dimensions", () => {
		const imported = importSynoptic(
			synoptic('<rect id="r" x="0" y="0" width="10" height="10" />', 'viewBox="0 0 300 150"')
		);

		expect(imported.file.project.canvas).toMatchObject({ width: 300, height: 150 });
	});
});

describe("synoptic import - canvas clipping", () => {
	it("drops elements outside the declared canvas", () => {
		const imported = importSynoptic(
			synoptic(
				'<rect id="inside" x="10" y="10" width="30" height="30" />' +
					'<rect id="outside" x="300" y="300" width="50" height="50" />',
				'viewBox="0 0 100 100"'
			)
		);

		expect(imported.file.project.elements).toHaveLength(1);
		expect(imported.file.project.elements[0]).toMatchObject({ name: "inside" });
		expect(imported.warnings).toContainEqual(
			expect.objectContaining({ type: SvgImportWarningType.DroppedOutsideCanvas })
		);
	});

	it("keeps all elements when no canvas is declared", () => {
		const imported = importSynoptic(
			`<svg class="${SYNOPTIC}" xmlns="http://www.w3.org/2000/svg">` +
				'<rect id="a" x="0" y="0" width="50" height="50" />' +
				'<rect id="b" x="500" y="500" width="50" height="50" />' +
				"</svg>"
		);

		expect(imported.file.project.elements).toHaveLength(2);
		expect(imported.warnings).not.toContainEqual(
			expect.objectContaining({ type: SvgImportWarningType.DroppedOutsideCanvas })
		);
	});
});

describe("synoptic import - fitCanvas", () => {
	it("auto-fits canvas to element bounds when no viewBox or dimensions", () => {
		const imported = importSynoptic(
			`<svg class="${SYNOPTIC}" xmlns="http://www.w3.org/2000/svg">` +
				'<rect id="a" x="100" y="200" width="50" height="30" />' +
				'<rect id="b" x="200" y="250" width="60" height="40" />' +
				"</svg>"
		);

		expect(imported.file.project.canvas.width).toBe(160);
		expect(imported.file.project.canvas.height).toBe(90);
		expect(imported.file.project.canvas.x).toBe(0);
		expect(imported.file.project.canvas.y).toBe(0);
	});

	it("translates elements to zero origin during fitCanvas", () => {
		const imported = importSynoptic(
			`<svg class="${SYNOPTIC}" xmlns="http://www.w3.org/2000/svg">` +
				'<rect id="a" x="100" y="200" width="50" height="30" />' +
				"</svg>"
		);

		expect(imported.file.project.elements[0]).toMatchObject({ x: 0, y: 0 });
	});
});

describe("synoptic import - duplicate IDs", () => {
	it("renames elements with duplicate IDs", () => {
		const imported = importSynoptic(
			synoptic(
				'<rect id="dup" x="0" y="0" width="20" height="20" />' +
					'<rect id="dup" x="30" y="0" width="20" height="20" />'
			)
		);

		const ids = imported.file.project.elements.map((e) => e.id);
		expect(ids).toHaveLength(2);
		expect(new Set(ids).size).toBe(2);
		expect(imported.warnings).toContainEqual(
			expect.objectContaining({ type: SvgImportWarningType.DuplicateElementId })
		);
	});
});

describe("synoptic import - background image", () => {
	it("imports an embedded background image as an asset", () => {
		const imported = importSynoptic(
			synoptic(
				'<image id="bg" href="data:image/png;base64,abc" width="200" height="100" />',
				'viewBox="0 0 200 100"'
			)
		);

		expect(imported.file.project.elements).toHaveLength(1);
		expect(imported.file.project.elements[0]).toMatchObject({
			type: "image",
			name: "floorplan",
			width: 200,
			height: 100,
			assetId: "asset-bg"
		});

		expect(imported.file.imageAssets).toHaveLength(1);
		expect(imported.file.imageAssets[0]).toMatchObject({
			id: "asset-bg",
			mimeType: "image/png",
			width: 200,
			height: 100
		});
	});

	it("reads xlink:href when href is absent", () => {
		const imported = importSynoptic(
			synoptic(
				'<image id="bg" xlink:href="data:image/jpeg;base64,xyz" width="100" height="50" />',
				'viewBox="0 0 100 50"'
			)
		);

		expect(imported.file.imageAssets[0]).toMatchObject({ mimeType: "image/jpeg" });
	});
});

describe("synoptic import - path commands", () => {
	it("translates open paths with H and V commands", () => {
		const imported = importSynoptic(synoptic('<path id="hv" d="M10,10 H50 V40" />'));
		const el = imported.file.project.elements[0];

		expect(el).toMatchObject({ type: "path", closed: false, x: 10, y: 10 });
	});

	it("translates open paths with relative commands", () => {
		const imported = importSynoptic(synoptic('<path id="rel" d="m10,10 l40,0 l0,30" />'));
		const el = imported.file.project.elements[0];

		expect(el).toMatchObject({ type: "path", closed: false, x: 10, y: 10 });
	});

	it("preserves raw d string for closed paths (Z terminates point extraction)", () => {
		const imported = importSynoptic(synoptic('<path id="closed" d="M10,10 H50 V40 H10 Z" />'));
		const el = imported.file.project.elements[0];

		expect(el).toMatchObject({ type: "path", closed: true, x: 0, y: 0 });
		expect(el.type === "path" && el.d).toBe("M10,10 H50 V40 H10 Z");
	});

	it("preserves raw d string for unsupported commands (curves)", () => {
		const imported = importSynoptic(synoptic('<path id="curve" d="M10,10 C20,20 30,20 40,10" />'));
		const el = imported.file.project.elements[0];

		expect(el).toMatchObject({ type: "path", x: 0, y: 0 });
		expect(el.type === "path" && el.d).toBe("M10,10 C20,20 30,20 40,10");
	});
});

describe("synoptic import - polygon warnings", () => {
	it("warns on polygons with fewer than 3 points", () => {
		const imported = importSynoptic(
			synoptic('<polygon id="small" points="10,10 20,20" /><rect id="ok" x="0" y="0" width="10" height="10" />')
		);

		expect(imported.file.project.elements).toHaveLength(1);
		expect(imported.warnings).toContainEqual(
			expect.objectContaining({
				type: SvgImportWarningType.InvalidPolygon,
				source: { tag: "polygon", elementId: "small", attribute: "points" }
			})
		);
	});

	it("warns on polygons with odd number of coordinates", () => {
		const imported = importSynoptic(
			synoptic('<polygon id="odd" points="10,10,20,20,30" /><rect id="ok" x="0" y="0" width="10" height="10" />')
		);

		expect(imported.file.project.elements).toHaveLength(1);
		expect(imported.warnings).toContainEqual(
			expect.objectContaining({ type: SvgImportWarningType.InvalidPolygon })
		);
	});

	it("warns on polygons with non-numeric coordinates", () => {
		const imported = importSynoptic(
			synoptic(
				'<polygon id="nan" points="10,10,abc,20,30,30" /><rect id="ok" x="0" y="0" width="10" height="10" />'
			)
		);

		expect(imported.file.project.elements).toHaveLength(1);
		expect(imported.warnings).toContainEqual(
			expect.objectContaining({ type: SvgImportWarningType.InvalidPolygon })
		);
	});
});

describe("synoptic import - error cases", () => {
	it("rejects SVG without a root svg element", () => {
		const exit = Effect.runSyncExit(svgEffect.import('<div class="not-svg"></div>'));

		expect(Exit.isFailure(exit)).toBe(true);
	});

	it("imports SVG without the Synoptic class through the generic fallback", () => {
		const imported = Effect.runSync(
			svgEffect.import('<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" /></svg>')
		);

		expect(imported.source).toBe("generic");
		expect(imported.warnings).toContainEqual(
			expect.objectContaining({ type: SvgImportWarningType.GenericFallback })
		);
	});

	it("rejects Synoptic SVG with non-data-URL background image", () => {
		const exit = Effect.runSyncExit(
			svgEffect.import(synoptic('<image href="https://example.com/img.png" width="100" height="100" />'))
		);

		expect(Exit.isFailure(exit)).toBe(true);
	});

	it("rejects Synoptic SVG with background image missing dimensions", () => {
		const exit = Effect.runSyncExit(
			svgEffect.import(synoptic('<image href="data:image/png;base64,abc" width="100" />'))
		);

		expect(Exit.isFailure(exit)).toBe(true);
	});
});

describe("synoptic import - canvas from width/height", () => {
	it("uses explicit width/height when viewBox is absent", () => {
		const imported = importSynoptic(
			`<svg class="${SYNOPTIC}" xmlns="http://www.w3.org/2000/svg" width="400" height="300">` +
				'<rect id="r" x="10" y="10" width="20" height="20" />' +
				"</svg>"
		);

		expect(imported.file.project.canvas).toMatchObject({ width: 400, height: 300 });
	});
});

describe("synoptic import - project metadata", () => {
	it("uses SVG id as project name", () => {
		const imported = importSynoptic(
			`<svg id="Floor Plan" class="${SYNOPTIC}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">` +
				'<rect id="r" x="0" y="0" width="10" height="10" />' +
				"</svg>"
		);

		expect(imported.file.project.name).toBe("Floor Plan");
	});

	it("falls back to 'Imported SVG' when no id", () => {
		const imported = importSynoptic(synoptic('<rect id="r" x="0" y="0" width="10" height="10" />'));

		expect(imported.file.project.name).toBe("Imported SVG");
	});
});
