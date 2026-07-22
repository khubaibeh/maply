import { afterEach, describe, expect, it, vi } from "vitest";

import { downloadName, downloadText } from "../../src/lib/browser-download";

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe("downloadName", () => {
	it("normalizes unsafe names", () => {
		expect(downloadName("  My / Project?! ", "json")).toBe("my-project.json");
	});

	it("uses a stable fallback", () => {
		expect(downloadName("---", "svg")).toBe("maply-project.svg");
	});

	it("clicks an attached link before releasing its object URL", () => {
		vi.useFakeTimers();
		const events: string[] = [];
		const link = {
			href: "",
			download: "",
			click: () => events.push("click"),
			remove: () => events.push("remove")
		};

		vi.stubGlobal("document", {
			body: { appendChild: () => events.push("append") },
			createElement: () => link
		});
		vi.stubGlobal("URL", {
			createObjectURL: () => "blob:export",
			revokeObjectURL: () => events.push("revoke")
		});

		downloadText("project.svg", "<svg />", "image/svg+xml");

		expect(link).toMatchObject({ href: "blob:export", download: "project.svg" });
		expect(events).toEqual(["append", "click", "remove"]);
		vi.runAllTimers();
		expect(events).toEqual(["append", "click", "remove", "revoke"]);
	});
});
