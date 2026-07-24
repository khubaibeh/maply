import { describe, expect, it } from "vitest";

import { parseFile } from "../../../../src/components/elements-panel/grid/ingest/file";
import { MAX_FILE_BYTES } from "../../../../src/components/elements-panel/grid/ingest/types";

describe("file import limits", () => {
	it("rejects oversized files before reading their contents", async () => {
		const file = new File(["x".repeat(MAX_FILE_BYTES + 1)], "oversized.csv", { type: "text/csv" });

		await expect(parseFile(file)).rejects.toMatchObject({ code: "file_too_large" });
	});

	it("accepts a file exactly at the size limit", async () => {
		const file = new File(["x".repeat(MAX_FILE_BYTES)], "limit.csv", { type: "text/csv" });

		await expect(parseFile(file)).resolves.toMatchObject({ matrix: [["x".repeat(MAX_FILE_BYTES)]] });
	});
});
