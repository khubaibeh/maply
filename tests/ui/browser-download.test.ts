import { describe, expect, it } from "vitest";

import { downloadName } from "../../src/components/project-menu/browser-download";

describe("downloadName", () => {
	it("normalizes unsafe names", () => {
		expect(downloadName("  My / Project?! ", "json")).toBe("my-project.json");
	});

	it("uses a stable fallback", () => {
		expect(downloadName("---", "svg")).toBe("maply-project.svg");
	});
});
