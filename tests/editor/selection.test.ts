import { selectMany } from "editor/selection/commands";
import { projectState, updateProjectState } from "editor/state/document";
import { get } from "svelte/store";
import { describe, expect, it } from "vitest";

describe("selectMany", () => {
	it("replaces the selection and keeps the last ID active", () => {
		updateProjectState((state) => ({ ...state, selectedElementIds: [], selectedElementId: null }), "preserve");

		selectMany(["first", "middle", "last"]);

		expect(get(projectState)).toMatchObject({
			selectedElementIds: ["first", "middle", "last"],
			selectedElementId: "last"
		});
	});
});
