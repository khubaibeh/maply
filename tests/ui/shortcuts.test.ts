import { getHistoryShortcut } from "@components/core/shortcuts";
import { describe, expect, it } from "vitest";

function shortcut(
	key: string,
	options: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean; altKey?: boolean } = {}
) {
	return getHistoryShortcut({
		key,
		ctrlKey: options.ctrlKey ?? false,
		metaKey: options.metaKey ?? false,
		shiftKey: options.shiftKey ?? false,
		altKey: options.altKey ?? false
	});
}

describe("history shortcuts", () => {
	it("supports undo on Control and Command keyboards", () => {
		expect(shortcut("z", { ctrlKey: true })).toBe("undo");
		expect(shortcut("Z", { metaKey: true })).toBe("undo");
	});

	it("supports both common redo shortcuts", () => {
		expect(shortcut("z", { metaKey: true, shiftKey: true })).toBe("redo");
		expect(shortcut("y", { ctrlKey: true })).toBe("redo");
	});

	it("ignores unmodified and Alt-modified keys", () => {
		expect(shortcut("z")).toBeNull();
		expect(shortcut("z", { ctrlKey: true, altKey: true })).toBeNull();
	});
});
