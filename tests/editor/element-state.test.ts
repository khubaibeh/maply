import { createElementNameGrid } from "@maply/model";
import type { Element, ImageElement, RectElement } from "@maply/model/types";
import { setBindable, setLocked, setVisible } from "editor/elements/state";
import { projectState, setProjectState } from "editor/state/document";
import { interactionState, resetInteractionState, updateInteractionState } from "editor/state/interaction";
import { get } from "svelte/store";
import { describe, expect, it } from "vitest";

function rect(id: string): RectElement {
	return {
		id,
		name: id,
		type: "rect",
		locked: false,
		visible: true,
		bindable: true,
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		fill: "#000",
		stroke: "#000",
		strokeWidth: 1
	};
}

function image(id: string): ImageElement {
	return {
		id,
		name: id,
		type: "image",
		locked: false,
		visible: true,
		bindable: false,
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		assetId: null,
		cropX: 0,
		cropY: 0,
		cropScale: 100
	};
}

function setFixture(elements: Element[], selectedElementIds: string[] = []) {
	setProjectState(
		{
			id: "prod",
			name: "Test",
			elements,
			elementNameGrid: createElementNameGrid(),
			isElementNameImportOpen: true,
			initialized: true
		},
		"rescan"
	);
	resetInteractionState();
	updateInteractionState((state) => ({
		...state,
		selectedElementIds,
		selectedElementId: selectedElementIds.at(-1) ?? null
	}));
}

describe("element state", () => {
	it("sets locked and bindable state for one or many elements", () => {
		setFixture([rect("first"), rect("second")]);

		setLocked("first", true);
		setBindable(["first", "second"], false);

		expect(get(projectState).elements).toMatchObject([
			{ id: "first", locked: true, bindable: false },
			{ id: "second", locked: false, bindable: false }
		]);
	});

	it("locking elements clears their hover and crop state while retaining selection", () => {
		setFixture([rect("first"), image("image")], ["first", "image"]);
		updateInteractionState((state) => ({ ...state, hoveredElementId: "image", cropEditingElementId: "image" }));

		setLocked("image", true);

		expect(get(projectState).elements).toMatchObject([
			{ id: "first", locked: false },
			{ id: "image", locked: true }
		]);
		expect(get(interactionState)).toMatchObject({
			selectedElementIds: ["first", "image"],
			hoveredElementId: null,
			cropEditingElementId: null
		});
	});

	it("hiding elements clears their hover and crop state while retaining selection", () => {
		setFixture([rect("first"), image("image"), rect("last")], ["first", "image", "last"]);
		updateInteractionState((state) => ({ ...state, hoveredElementId: "image", cropEditingElementId: "image" }));

		setVisible(["first", "image"], false);

		expect(get(projectState).elements).toMatchObject([
			{ id: "first", visible: false },
			{ id: "image", visible: false },
			{ id: "last", visible: true }
		]);
		expect(get(interactionState)).toMatchObject({
			selectedElementIds: ["first", "image", "last"],
			selectedElementId: "last",
			hoveredElementId: null,
			cropEditingElementId: null
		});

		setVisible(["first", "image"], true);
		expect(get(interactionState)).toMatchObject({
			selectedElementIds: ["first", "image", "last"]
		});
		expect(get(projectState).elements.slice(0, 2)).toMatchObject([
			{ id: "first", visible: true },
			{ id: "image", visible: true }
		]);
	});

	it("keeps crop mode when hiding a different element", () => {
		setFixture([rect("hidden"), image("image")], ["image"]);
		updateInteractionState((state) => ({ ...state, cropEditingElementId: "image" }));

		setVisible("hidden", false);

		expect(get(interactionState)).toMatchObject({
			selectedElementIds: ["image"],
			cropEditingElementId: "image"
		});
		expect(get(projectState).elements[0]).toMatchObject({ id: "hidden", visible: false });
	});

	it("showing elements leaves interaction state intact", () => {
		setFixture([{ ...rect("hidden"), visible: false }, rect("selected")], ["selected"]);
		updateInteractionState((state) => ({ ...state, hoveredElementId: "selected" }));

		setVisible("hidden", true);

		expect(get(interactionState)).toMatchObject({
			selectedElementIds: ["selected"],
			hoveredElementId: "selected"
		});
		expect(get(projectState).elements[0]).toMatchObject({ id: "hidden", visible: true });
	});
});
