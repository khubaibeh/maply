import type { ImageElement, RectElement } from "@maply/model/types";
import { createIndexedDocument } from "editor/state/indexed-document";
import { describe, expect, it } from "vitest";

function rect(id: string, x = 0, y = 0, width = 10, height = 10): RectElement {
	return {
		id,
		name: id,
		type: "rect",
		locked: false,
		visible: true,
		bindable: true,
		x,
		y,
		width,
		height,
		fill: "#000",
		stroke: "#000",
		strokeWidth: 1
	};
}

function image(id: string, assetId: string | null): ImageElement {
	return {
		id,
		name: id,
		type: "image",
		bindable: false,
		locked: false,
		visible: true,
		x: 0,
		y: 0,
		width: 10,
		height: 10,
		assetId,
		href: "",
		cropX: 0,
		cropY: 0,
		cropScale: 1
	};
}

describe("indexed document", () => {
	it("keeps ID lookup separate from ordered layer iteration", () => {
		const document = createIndexedDocument([rect("a"), rect("b"), rect("c")]);
		const copy = document.get("b");
		const changed = copy ? { ...copy, name: "changed outside" } : null;

		expect(document.size()).toBe(3);
		expect(changed?.name).toBe("changed outside");
		expect(document.get("b")?.name).toBe("b");
		expect([...document.ordered()].map((element) => element.id)).toEqual(["a", "b", "c"]);
	});

	it("publishes one typed change set for each atomic mutation", () => {
		const document = createIndexedDocument([rect("a"), rect("b"), rect("c")]);
		const changes: string[] = [];
		document.subscribe((change) => changes.push(`${change.revision}:${change.tag}`));

		const added = document.add([rect("d")], 1);
		const updated = document.update("b", (element) => ({ ...element, name: "B" }));
		const deleted = document.delete(["a"]);
		const moved = document.reorder(["d"], 2);

		expect(added?.order).toEqual({ tag: "insert", ids: ["d"], index: 1 });
		expect(updated?.changes[0]).toMatchObject({ id: "b", before: { name: "b" }, after: { name: "B" } });
		expect(deleted?.changes[0]).toMatchObject({ id: "a", before: { id: "a" }, after: null });
		expect(moved?.tag).toBe("reorder");
		expect(changes).toEqual(["1:add", "2:update", "3:delete", "4:reorder"]);
		expect(document.snapshot().map((element) => element.id)).toEqual(["b", "c", "d"]);
	});

	it("updates several IDs without exposing its internal collection", () => {
		const document = createIndexedDocument([rect("a"), rect("b"), rect("c")]);
		const change = document.updateMany(["c", "missing", "a"], (element) => ({
			...element,
			locked: true
		}));

		expect(change?.changes.map((entry) => entry.id)).toEqual(["c", "a"]);
		expect(document.snapshot().map((element) => element.locked)).toEqual([true, false, true]);
	});

	it("replays typed changes to the same ordered document", () => {
		const document = createIndexedDocument([rect("a"), rect("b")]);
		const replay = new Map(document.snapshot().map((element) => [element.id, element]));
		let order = ["a", "b"];

		const apply = (change: NonNullable<ReturnType<typeof document.add>>) => {
			const orderChange = change.order;
			for (const entry of change.changes) {
				if (entry.after) replay.set(entry.id, entry.after);
				else replay.delete(entry.id);
			}
			if (orderChange.tag === "insert") {
				order = [...order.slice(0, orderChange.index), ...orderChange.ids, ...order.slice(orderChange.index)];
			}
			if (orderChange.tag === "remove") order = order.filter((id) => !orderChange.ids.includes(id));
			if (orderChange.tag === "move") {
				const moved = new Set(orderChange.ids);
				const remaining = order.filter((id) => !moved.has(id));
				order = [
					...remaining.slice(0, orderChange.toIndex),
					...orderChange.ids,
					...remaining.slice(orderChange.toIndex)
				];
			}
			if (orderChange.tag === "replace") order = [...orderChange.after];
		};

		apply(document.add([rect("c")], 1)!);
		apply(document.update("b", (element) => ({ ...element, name: "B" }))!);
		apply(document.reorder(["c"], 0)!);
		apply(document.delete(["a"])!);

		expect(order.map((id) => replay.get(id))).toEqual(document.snapshot());
	});

	it("replays a mixed change sequence in both directions", () => {
		const source = createIndexedDocument([rect("a"), rect("b"), rect("c")]);
		const changes = [
			source.add([rect("d")], 1),
			source.update("b", (element) => ({ ...element, name: "B" })),
			source.reorder(["d"], 2),
			source.delete(["a"])
		].filter((change): change is NonNullable<typeof change> => change !== null);
		const expected = source.snapshot();
		const replay = createIndexedDocument([rect("a"), rect("b"), rect("c")]);

		for (const change of changes) replay.replay(change.changes, [change.order], "after");
		expect(replay.snapshot()).toEqual(expected);

		for (const change of [...changes].reverse()) replay.replay(change.changes, [change.order], "before");
		expect(replay.snapshot()).toEqual([rect("a"), rect("b"), rect("c")]);
	});

	it("reports complete before and after data when replacing the document", () => {
		const document = createIndexedDocument([rect("a"), rect("b")]);
		const change = document.replace([rect("b"), rect("c")]);

		expect(change.tag).toBe("replace");
		expect(change.changes).toEqual([
			expect.objectContaining({ id: "a", before: expect.objectContaining({ id: "a" }), after: null }),
			expect.objectContaining({
				id: "b",
				before: expect.objectContaining({ id: "b" }),
				after: expect.objectContaining({ id: "b" })
			}),
			expect.objectContaining({ id: "c", before: null, after: expect.objectContaining({ id: "c" }) })
		]);
		expect(change.order).toEqual({ tag: "replace", before: ["a", "b"], after: ["b", "c"] });
	});

	it("keeps spatial candidates current and returns them in layer order", () => {
		const document = createIndexedDocument([rect("back", 0, 0), rect("front", 5, 5), rect("outside", 100, 100)]);

		expect(document.query({ x: 4, y: 4, width: 2, height: 2 })).toEqual(["back", "front"]);
		expect(document.queryPoint({ x: 6, y: 6 })).toEqual(["back", "front"]);
		expect(document.query({ x: 100, y: 100, width: 0, height: 0 }, ["front"])).toEqual(["front", "outside"]);

		document.update("front", (element) => ({ ...element, x: 200, y: 200 }));
		expect(document.queryPoint({ x: 6, y: 6 })).toEqual(["back"]);

		document.reorder(["outside"], 0);
		expect(document.query({ x: 95, y: 95, width: 20, height: 20 })).toEqual(["outside"]);
		document.delete(["outside"]);
		expect(document.query({ x: 95, y: 95, width: 20, height: 20 })).toEqual([]);
	});

	it("maintains names, validation, and referenced assets incrementally", () => {
		const document = createIndexedDocument([rect("first"), image("photo", "asset-1")]);

		expect(document.nameCounts()).toEqual(
			new Map([
				["first", 1],
				["photo", 1]
			])
		);
		expect(document.referencedAssetIds()).toEqual(["asset-1"]);

		document.update("photo", (element) => ({ ...element, name: "first", assetId: "asset-2" }));
		expect(document.validations().get("first")).toMatchObject({ valid: false, issues: ["duplicate"] });
		expect(document.validations().get("photo")).toMatchObject({ valid: false, issues: ["duplicate"] });
		expect(document.referencedAssetIds()).toEqual(["asset-2"]);

		document.delete(["photo"]);
		expect(document.referencedAssetIds()).toEqual([]);
		expect(document.validations().has("photo")).toBe(false);
	});
});
