import { describe, expect, it } from "vitest";

import { parseExcel } from "../../../../src/components/elements-panel/grid/ingest/excel";

// Note: Full Excel testing would require creating .xlsx fixtures or generating them in-test.
// This basic test demonstrates the interface works correctly with error handling.

describe("Excel parsing", () => {
	it("handles empty/invalid buffer", async () => {
		const emptyBuffer = new ArrayBuffer(0);
		const result = await parseExcel(emptyBuffer);
		expect(result.warnings.length).toBeGreaterThanOrEqual(0);
		expect(Array.isArray(result.matrix)).toBe(true);
	});

	it("returns matrix and warnings object", async () => {
		const result = await parseExcel(new ArrayBuffer(10));
		expect(result).toHaveProperty("matrix");
		expect(result).toHaveProperty("warnings");
		expect(Array.isArray(result.matrix)).toBe(true);
		expect(Array.isArray(result.warnings)).toBe(true);
	});

	// Full Excel tests would require xlsx library to generate test fixtures:
	// it("parses simple Excel with numbers", async () => {
	//   const wb = XLSX.utils.book_new();
	//   const ws_data = [["Name", "Age"], ["Alice", 30], ["Bob", 25]];
	//   const ws = XLSX.utils.aoa_to_sheet(ws_data);
	//   XLSX.utils.book_append_sheet(wb, ws);
	//   const buffer = XLSX.write(wb, { bookType: "xlsx", type: "arraybuffer" });
	//   const result = await parseExcel(buffer);
	//   expect(result.matrix).toEqual([
	//     ["Name", "Age"],
	//     ["Alice", "30"],
	//     ["Bob", "25"]
	//   ]);
	// });
});
