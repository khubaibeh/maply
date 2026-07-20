import { svg, validateMimeType } from "@maply/io";
import { describe, expect, it } from "vitest";

describe("image input security", () => {
	it.each(["image/png", "image/jpeg", "image/svg+xml"])("accepts supported MIME type %s", async (mimeType) => {
		expect((await validateMimeType(mimeType)).ok).toBe(true);
	});

	it("rejects unsupported MIME types", async () => {
		expect((await validateMimeType("text/html")).ok).toBe(false);
	});

	it.each([
		["scripts", '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'],
		["event handlers", '<svg xmlns="http://www.w3.org/2000/svg"><rect onclick="alert(1)" /></svg>'],
		["external hrefs", '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.com/a.png" /></svg>'],
		[
			"external xlink hrefs",
			'<svg xmlns="http://www.w3.org/2000/svg"><image xlink:href="https://example.com/a.png" /></svg>'
		]
	])("rejects SVG %s", async (_name, markup) => {
		expect((await svg.prepare(markup)).ok).toBe(false);
	});

	it("adds the SVG namespace to safe markup", async () => {
		const result = await svg.prepare('<svg viewBox="0 0 10 10"><rect width="10" height="10" /></svg>');
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(decodeURIComponent(result.value.dataUrl)).toContain('xmlns="http://www.w3.org/2000/svg"');
		}
	});
});
