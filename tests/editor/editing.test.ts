import type { RectElement } from "@maply/model/types";
import { setColor } from "editor/canvas/commands";
import { updateElement } from "editor/elements/mutate";
import { projectState, updateProjectState } from "editor/state/document";
import { beginAsyncEditorMutation, withEditorMutationBlock } from "editor/state/editing";
import { canvasState } from "editor/state/workspace";
import { get } from "svelte/store";
import { describe, expect, it } from "vitest";

function rect(): RectElement {
	return {
		id: "rect",
		name: "rect",
		type: "rect",
		locked: false,
		visible: true,
		bindable: true,
		x: 10,
		y: 10,
		width: 20,
		height: 20,
		fill: "#000",
		stroke: "#000",
		strokeWidth: 1
	};
}

describe("editor mutation block", () => {
	it("waits for admitted async mutations and rejects new ones", async () => {
		const releaseMutation = beginAsyncEditorMutation();
		expect(releaseMutation).not.toBeNull();
		let operationStarted = false;
		const operation = withEditorMutationBlock(async () => {
			operationStarted = true;
		});

		await Promise.resolve();
		expect(operationStarted).toBe(false);
		expect(beginAsyncEditorMutation()).toBeNull();

		releaseMutation?.();
		await operation;
		expect(operationStarted).toBe(true);
	});

	it("ignores document and canvas edits during a session operation", async () => {
		updateProjectState((state) => ({ ...state, elements: [rect()] }), "rescan");
		canvasState.set({ width: 100, height: 100, color: "#fff", x: 0, y: 0, camera: { x: 0, y: 0, zoom: 1 } });
		const blocker = Promise.withResolvers<void>();
		const blocked = withEditorMutationBlock(() => blocker.promise);

		updateElement("rect", { x: 40 });
		setColor("#123456");
		expect(get(projectState).elements[0]).toMatchObject({ x: 10 });
		expect(get(canvasState).color).toBe("#fff");

		blocker.resolve();
		await blocked;
		updateElement("rect", { x: 40 });
		setColor("#123456");
		expect(get(projectState).elements[0]).toMatchObject({ x: 40 });
		expect(get(canvasState).color).toBe("#123456");
	});
});
