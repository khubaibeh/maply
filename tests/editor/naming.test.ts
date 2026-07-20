import type { Element } from "@maply/model/types";
import { validateElementNames } from "editor/elements/naming";
import { describe, expect, it } from "vitest";

function element(id: string, name: string): Element {
	return {
		id,
		name,
		type: "rect",
		x: 0,
		y: 0,
		width: 10,
		height: 10,
		fill: "#000",
		stroke: "#000",
		strokeWidth: 0
	};
}

describe("validateElementNames", () => {
	it("reports selector-safe validation details and an autofix suggestion", () => {
		const validation = validateElementNames([
			element("one", "1 invalid name"),
			element("two", "1 invalid name")
		]).get("one");

		expect(validation).toEqual({
			id: "one",
			name: "1 invalid name",
			valid: false,
			issues: ["spaces", "starts-with-number", "duplicate"],
			messages: ["spaces", "starts with a number", "duplication"],
			suggestion: "element-1-invalid-name"
		});
	});
});
