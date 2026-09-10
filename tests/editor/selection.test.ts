import { selectMany } from "editor/selection/commands";
import { interactionState } from "editor/state/interaction";
import { get } from "svelte/store";
import { describe, expect, it } from "vitest";

describe("selectMany", () => {
	it("replaces the selection and keeps the last ID active", () => {
		selectMany(["first", "middle", "last"]);

		expect(get(interactionState)).toMatchObject({
			selectedElementIds: ["first", "middle", "last"],
			selectedElementId: "last"
		});
	});
});
