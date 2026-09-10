import { createElementNameGrid } from "@maply/model";
import type { RectElement } from "@maply/model/types";
import { getEditorBenchmarkCounters, resetEditorBenchmarkCounters } from "editor/benchmark-counters";
import { history } from "editor/history";
import { selectMany, setHover, toggleCrop } from "editor/selection/commands";
import { documentRevisionState, projectState, setProjectState } from "editor/state/document";
import { interactionRevisionState, interactionState, resetInteractionState } from "editor/state/interaction";
import { get } from "svelte/store";
import { describe, expect, it } from "vitest";

const element: RectElement = {
	id: "rect",
	name: "Rect",
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

function setFixture(): void {
	setProjectState(
		{
			id: "prod",
			name: "Interaction state",
			elements: [element],
			elementNameGrid: createElementNameGrid(),
			isElementNameImportOpen: true,
			initialized: true
		},
		"rescan"
	);
	resetInteractionState();
	history.reset();
	resetEditorBenchmarkCounters();
}

describe("transient interaction state", () => {
	it("publishes hover, selection, and crop without changing the document", () => {
		setFixture();
		const projectBefore = get(projectState);
		const documentRevisionBefore = get(documentRevisionState);
		const interactionRevisionBefore = get(interactionRevisionState);

		for (let index = 0; index < 1_000; index += 1) setHover(`hover-${index}`);
		selectMany([element.id]);
		toggleCrop(element.id);

		expect(get(projectState)).toBe(projectBefore);
		expect(get(documentRevisionState)).toBe(documentRevisionBefore);
		expect(get(interactionRevisionState)).toBeGreaterThan(interactionRevisionBefore);
		expect(get(interactionState)).toMatchObject({
			selectedElementId: element.id,
			selectedElementIds: [element.id],
			cropEditingElementId: element.id
		});
		expect(get(history.canUndo)).toBe(false);
		expect(getEditorBenchmarkCounters()).toMatchObject({
			documentRevisions: 0,
			changePublications: 0,
			historyRecords: 0,
			saveRequests: 0
		});
	});
});
