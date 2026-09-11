import { createElementNameGrid } from "@maply/model";
import type { CircleElement, PathElement } from "@maply/model/types";
import { beforeEach, describe, expect, it } from "vitest";

import { Editor } from "../../editor";
import { history } from "../../editor/history";
import { setProjectState } from "../../editor/state/document";
import { canvasState } from "../../editor/state/workspace";
import { chooseCanvasRenderer } from "../../src/components/canvas/canvas-renderer";
import {
	createElementHitTester,
	getPathHitTolerance,
	topmostHitElement
} from "../../src/components/canvas/interaction/element-hit-test";
import { insertPathVertexAtPointer } from "../../src/components/canvas/interaction/path-vertex";

function circle(overrides: Partial<CircleElement> = {}): CircleElement {
	return {
		id: "circle",
		name: "Circle",
		type: "circle",
		locked: false,
		visible: true,
		bindable: true,
		cx: 100,
		cy: 100,
		r: 50,
		fill: "#000",
		stroke: "none",
		strokeWidth: 0,
		...overrides
	};
}

function path(overrides: Partial<PathElement> = {}): PathElement {
	return {
		id: "path",
		name: "Path",
		type: "path",
		locked: false,
		visible: true,
		bindable: true,
		x: 50,
		y: 50,
		d: "M0,0 L100,0 L100,100 L0,100",
		fill: "none",
		stroke: "#000",
		strokeWidth: 1,
		closed: false,
		...overrides
	};
}

function resetEditor(elements: readonly PathElement[]): void {
	canvasState.set({ width: 120, height: 120, color: "#fff", x: 0, y: 0, camera: { x: 0, y: 0, zoom: 1 } });
	setProjectState(
		{
			id: "browser-interaction",
			name: "Browser interaction",
			elements: [...elements],
			elementNameGrid: createElementNameGrid(),
			isElementNameImportOpen: false,
			initialized: true
		},
		"rescan"
	);
	history.reset();
}

describe("Canvas interaction in a real browser", () => {
	beforeEach(() => {
		document.body.replaceChildren();
	});

	it("keeps dense Canvas picking shape-accurate for overlapping circles and paths", () => {
		const renderer = chooseCanvasRenderer(50_000, 2_001);
		const hitTester = createElementHitTester();
		const bottom = circle({ id: "bottom" });
		const topCircle = circle({ id: "top-circle", r: 20 });
		const topPath = path({ id: "top-path" });

		expect(renderer).toBe("canvas");
		expect(topmostHitElement([bottom, topCircle], { x: 130, y: 130 }, 1, hitTester)?.id).toBe("bottom");
		expect(topmostHitElement([bottom, topPath], { x: 100, y: 100 }, 1, hitTester)?.id).toBe("bottom");
		expect(topmostHitElement([bottom, topPath], { x: 140, y: 140 }, 1, hitTester)).toBeNull();
		expect(topmostHitElement([topPath], { x: 100, y: 56 }, 1, hitTester)?.id).toBe("top-path");
		expect(topmostHitElement([topPath], { x: 100, y: 56 }, 2, hitTester)).toBeNull();
		expect(getPathHitTolerance(2)).toBe(3.5);

		hitTester.dispose();
	});

	it("routes a browser double-click on a Canvas overlay path to vertex insertion", () => {
		const element = path({ id: "editable-path", x: 0, y: 0, d: "M0,0 L100,0" });
		resetEditor([element]);

		const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		svg.setAttribute("width", "120");
		svg.setAttribute("height", "120");
		svg.setAttribute("viewBox", "0 0 120 120");
		svg.style.position = "fixed";
		svg.style.inset = "0";
		document.body.append(svg);

		const transform = svg.getScreenCTM();
		expect(transform).not.toBeNull();
		const screenPoint = new DOMPoint(50, 1).matrixTransform(transform!);
		const event = new MouseEvent("dblclick", {
			bubbles: true,
			clientX: screenPoint.x,
			clientY: screenPoint.y
		});

		expect(insertPathVertexAtPointer(event, element, svg, 1)).toBe(true);
		expect((Editor.document.get(element.id) as PathElement).d).toBe("M0,0 L49,0 L100,0");
	});
});
