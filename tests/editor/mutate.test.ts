import type { RectElement } from "@maply/model/types";
import { translateElement, translateElements } from "editor/elements/mutate";
import { projectState, updateProjectState } from "editor/state/document";
import { canvasState } from "editor/state/workspace";
import { get } from "svelte/store";
import { describe, expect, it } from "vitest";

function rect(id: string, x: number, y: number): RectElement {
	return {
		id,
		name: id,
		type: "rect",
		x,
		y,
		width: 100,
		height: 100,
		fill: "#000",
		stroke: "#000",
		strokeWidth: 1
	};
}

function setFixture(elements: RectElement[]) {
	canvasState.set({ width: 300, height: 300, color: "#fff", x: 0, y: 0, camera: { x: 0, y: 0, zoom: 1 } });
	updateProjectState((state) => ({ ...state, elements }), "rescan");
}

describe("translateElement", () => {
	it("returns the applied delta when movement is clamped at the canvas edge", () => {
		setFixture([rect("a", 180, 40)]);

		expect(translateElement("a", 200, 0)).toEqual({ x: 20, y: 0 });
		expect(get(projectState).elements[0]).toMatchObject({ x: 200, y: 40 });
	});

	it("returns the clamped group delta for multi-selection moves", () => {
		setFixture([rect("a", 0, 0), rect("b", 180, 0)]);

		expect(translateElements(["a", "b"], 50, 0)).toEqual({ x: 20, y: 0 });
		expect(get(projectState).elements).toMatchObject([
			{ id: "a", x: 20, y: 0 },
			{ id: "b", x: 200, y: 0 }
		]);
	});
});
