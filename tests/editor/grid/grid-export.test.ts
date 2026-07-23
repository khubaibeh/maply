import type { Element } from "@maply/model/types";
import { describe, expect, it } from "vitest";

import { nameMappingsCsv } from "../../../src/components/elements-panel/grid/grid-export";

function element(id: string, name: string): Element {
	return {
		id,
		name,
		type: "rect",
		bindable: true,
		locked: false,
		visible: true,
		x: 0,
		y: 0,
		width: 1,
		height: 1,
		fill: "#000",
		stroke: "#000",
		strokeWidth: 0
	};
}

describe("name mapping export", () => {
	it("writes headers and joins multiple element names with semicolons", () => {
		const csv = nameMappingsCsv(
			["Name", "Category"],
			[
				["Kitchen", "Room"],
				["", ""]
			],
			[[element("one", "floor"), element("two", "ceiling")], [element("three", "unmapped")]]
		);

		expect(csv).toBe("Name,Category,Elements\r\nKitchen,Room,floor;ceiling\r\n,,unmapped");
	});

	it("escapes CSV fields containing commas and quotes", () => {
		const csv = nameMappingsCsv(["Name"], [["A, B"]], [[element("one", 'Door "A"')]]);

		expect(csv).toBe('Name,Elements\r\n"A, B","Door ""A"""');
	});

	it.each(["=SUM(A1:A2)", "+value", "-value", "@value", "  =value"])(
		"neutralizes spreadsheet formulas starting with %s",
		(value) => {
			expect(nameMappingsCsv(["Name"], [[value]], [[]])).toBe(`Name,Elements\r\n'${value},`);
		}
	);
});
