import type { Element } from "@maply/model/types";
import { describe, expect, it } from "vitest";

import { elementsByNameRow } from "../../../src/components/elements-panel/grid/element-bindings";

function rectangle(id: string, name: string, bindable = true): Element {
	return {
		id,
		name,
		type: "rect",
		bindable,
		locked: false,
		visible: true,
		x: 0,
		y: 0,
		width: 10,
		height: 10,
		fill: "#000000",
		stroke: "#000000",
		strokeWidth: 0
	};
}

describe("element name bindings", () => {
	it("matches bindable elements by the complete name", () => {
		const exact = rectangle("exact", "Alpha");
		const differentCase = rectangle("case", "alpha");

		const result = elementsByNameRow([["Alpha"], [""]], [exact, differentCase]);

		expect(result[0]).toEqual([exact]);
		expect(result[1]).toEqual([differentCase]);
	});

	it("places non-bindable elements in the blank row", () => {
		const nonBindable = rectangle("fixed", "Alpha", false);

		const result = elementsByNameRow([["Alpha"], [""]], [nonBindable]);

		expect(result[0]).toEqual([]);
		expect(result[1]).toEqual([nonBindable]);
	});

	it("places unmatched bindable elements in the blank row", () => {
		const unmatched = rectangle("unmatched", "Beta");

		const result = elementsByNameRow([["Alpha"], [""]], [unmatched]);

		expect(result[1]).toEqual([unmatched]);
	});
});
