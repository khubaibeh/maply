import type { RectElement } from "@maply/model/types";
import { minimumCanvasSizeState, projectState, setProjectState, updateProjectState } from "editor/state/document";
import { get } from "svelte/store";
import { describe, expect, it } from "vitest";

function rect(id: string, width: number, height: number): RectElement {
	return {
		id,
		name: id,
		type: "rect",
		locked: false,
		visible: true,
		bindable: true,
		x: 0,
		y: 0,
		width,
		height,
		fill: "#000",
		stroke: "#000",
		strokeWidth: 1
	};
}

function reset(elements: RectElement[]) {
	setProjectState(
		{
			id: "prod",
			name: "Test",
			elements,
			initialized: true,
			selectedElementId: null,
			selectedElementIds: [],
			hoveredElementId: null,
			cropEditingElementId: null
		},
		"rescan"
	);
}

describe("minimumCanvasSizeState", () => {
	it("updates only the exceeded dimension when adding a larger element", () => {
		reset([rect("a", 100, 80), rect("b", 70, 150)]);

		const added = rect("c", 120, 90);
		setProjectState({ ...get(projectState), elements: [...get(projectState).elements, added] }, { added: [added] });

		expect(get(minimumCanvasSizeState)).toEqual({ width: 120, height: 150 });
	});

	it("rescans both dimensions when the current holder shrinks", () => {
		reset([rect("a", 100, 120), rect("b", 95, 70), rect("c", 80, 110)]);

		const before = get(projectState).elements[0] as RectElement;
		const after = { ...before, width: 90, height: 60 };
		setProjectState(
			{
				...get(projectState),
				elements: get(projectState).elements.map((element) => (element.id === after.id ? after : element))
			},
			{ changed: { before, after } }
		);

		expect(get(minimumCanvasSizeState)).toEqual({ width: 95, height: 110 });
	});

	it("leaves the cache unchanged when a non-holder shrinks", () => {
		reset([rect("a", 100, 120), rect("b", 95, 70), rect("c", 80, 110)]);

		const before = get(projectState).elements[1] as RectElement;
		const after = { ...before, width: 60, height: 50 };
		setProjectState(
			{
				...get(projectState),
				elements: get(projectState).elements.map((element) => (element.id === after.id ? after : element))
			},
			{ changed: { before, after } }
		);

		expect(get(minimumCanvasSizeState)).toEqual({ width: 100, height: 120 });
	});

	it("rescans when deleting a width or height holder", () => {
		reset([rect("a", 100, 80), rect("b", 70, 150), rect("c", 90, 60)]);

		setProjectState(
			{ ...get(projectState), elements: get(projectState).elements.filter((element) => element.id !== "b") },
			{ deleted: ["b"] }
		);

		expect(get(minimumCanvasSizeState)).toEqual({ width: 100, height: 80 });
	});

	it("supports explicit rescans and preserve hints", () => {
		reset([rect("a", 100, 80)]);

		updateProjectState((state) => ({ ...state, name: "Renamed" }), "preserve");
		expect(get(minimumCanvasSizeState)).toEqual({ width: 100, height: 80 });

		setProjectState({ ...get(projectState), elements: [rect("a", 60, 40)] }, "rescan");
		expect(get(minimumCanvasSizeState)).toEqual({ width: 60, height: 40 });
	});
});
