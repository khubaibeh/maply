import { describe, expect, it } from "vitest";

import { loadNameGrid, saveNameGrid } from "../../../src/components/elements-panel/grid/name-grid-state";

describe("name grid session state", () => {
	it("retains a grid independently for each project", () => {
		saveNameGrid("project-a", { headers: ["Name"], rows: [["Alpha"], [""]] });
		saveNameGrid("project-b", { headers: ["Name"], rows: [["Beta"], [""]] });

		expect(loadNameGrid("project-a")).toEqual({ headers: ["Name"], rows: [["Alpha"], [""]] });
		expect(loadNameGrid("project-b")).toEqual({ headers: ["Name"], rows: [["Beta"], [""]] });
	});

	it("does not expose its stored arrays for mutation", () => {
		const data = { headers: ["Name"], rows: [["Alpha"], [""]] };
		saveNameGrid("isolated", data);
		data.rows[0][0] = "Changed";

		const loaded = loadNameGrid("isolated");
		loaded?.rows[0].splice(0, 1, "Changed again");

		expect(loadNameGrid("isolated")).toEqual({ headers: ["Name"], rows: [["Alpha"], [""]] });
	});
});
