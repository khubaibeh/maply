import { describe, expect, it } from "vitest";

import { getVirtualWindow } from "../../src/components/elements-panel/virtualize";

describe("elements panel virtualization", () => {
	it("mounts a bounded overscanned window", () => {
		const window = getVirtualWindow(50_000, 30_000 * 30, 600);

		expect(window.totalSize).toBe(1_500_000);
		expect(window.start).toBe(29994);
		expect(window.end).toBe(30026);
		expect(window.indexes).toHaveLength(32);
	});

	it("keeps pinned rows mounted outside the scroll window", () => {
		const window = getVirtualWindow(50_000, 0, 300, { pinnedIndexes: [25_000] });

		expect(window.indexes).toContain(25_000);
		expect(window.indexes.length).toBeLessThan(30);
	});

	it("clamps windows at both list edges", () => {
		expect(getVirtualWindow(4, 0, 90).indexes).toEqual([0, 1, 2, 3]);
		expect(getVirtualWindow(4, 10_000, 90).indexes).toEqual([0, 1, 2, 3]);
	});
});
