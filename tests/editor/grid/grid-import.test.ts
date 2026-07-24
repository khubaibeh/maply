import { describe, expect, it } from "vitest";

import { applyImportMatrix } from "../../../src/components/elements-panel/grid/grid-import";

describe("grid import", () => {
	it("uses imported headers while preserving the Name header", () => {
		const result = applyImportMatrix(
			["Name"],
			[[""]],
			[
				["Imported name", "Age", "Status"],
				["Alice", "30", "Active"]
			],
			{ r: 0, c: 0 },
			true
		);

		expect(result.headers).toEqual(["Name", "Age", "Status"]);
		expect(result.rows).toEqual([
			["Alice", "30", "Active"],
			["", "", ""]
		]);
	});

	it("imports every row as data when the file has no header", () => {
		const result = applyImportMatrix(
			["Name"],
			[[""]],
			[
				["Alice", "30"],
				["Bob", "25"]
			],
			{ r: 0, c: 0 },
			false
		);

		expect(result.headers).toEqual(["Name", ""]);
		expect(result.rows).toEqual([
			["Alice", "30"],
			["Bob", "25"],
			["", ""]
		]);
	});

	it("rejects multiple blank Name rows with supplied values without changing the source rows", () => {
		const headers = ["Name", "Category"];
		const rows = [
			["Existing", "Room"],
			["", ""]
		];

		expect(() =>
			applyImportMatrix(
				headers,
				rows,
				[
					["", "First"],
					["", "Second"]
				],
				{ r: 0, c: 0 },
				false
			)
		).toThrow("Name is required for imported rows 1, 2.");
		expect(rows).toEqual([
			["Existing", "Room"],
			["", ""]
		]);
	});
});
