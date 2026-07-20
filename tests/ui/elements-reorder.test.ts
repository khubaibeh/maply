import { describe, expect, it } from "vitest";

import { projectInsertionIndex, reorderPreview } from "../../src/components/elements-panel/reorder";

describe("elements panel reorder", () => {
	it("converts reversed sidebar indexes to paint-order indexes", () => {
		expect(projectInsertionIndex(5, 0)).toBe(4);
		expect(projectInsertionIndex(5, 4)).toBe(0);
	});

	it("previews a row at its visual insertion index", () => {
		const elements = [{ id: "back" }, { id: "middle" }, { id: "front" }];
		expect(reorderPreview(elements, "back", 1).map((element) => element.id)).toEqual(["front", "back", "middle"]);
	});
});
