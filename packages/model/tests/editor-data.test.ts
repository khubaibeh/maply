import {
	createElementNameGrid,
	createProjectEditorData,
	getProjectEditorDataIssue,
	MAX_ELEMENT_NAME_GRID_COLUMNS
} from "@maply/model";
import { describe, expect, it } from "vitest";

describe("project editor data", () => {
	it("creates fresh canonical grids", () => {
		const first = createElementNameGrid();
		const second = createElementNameGrid();

		expect(first).not.toBe(second);
		expect(first.rows).not.toBe(second.rows);
		expect(second).toEqual({ headers: ["Name"], rows: [[""]] });
		expect(getProjectEditorDataIssue(createProjectEditorData())).toBeNull();
	});

	it("rejects noncanonical and oversized grids", () => {
		expect(
			getProjectEditorDataIssue({
				elementNameGrid: { headers: ["Other"], rows: [[""]] }
			})
		).toContain("Name column");
		expect(
			getProjectEditorDataIssue({
				elementNameGrid: {
					headers: ["Name", ...Array(MAX_ELEMENT_NAME_GRID_COLUMNS).fill("Value")],
					rows: [Array(MAX_ELEMENT_NAME_GRID_COLUMNS + 1).fill("")]
				}
			})
		).toContain("at most");
	});
});
