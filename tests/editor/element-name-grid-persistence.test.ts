import { createElementNameGrid } from "@maply/model";
import { storage } from "@maply/storage";
import { replaceElementNameGrid, setElementNameImportOpen } from "editor/elements/name-grid";
import { loadEditorSession } from "editor/session/load";
import { flushEditorSave } from "editor/session/save";
import { projectState, setProjectState } from "editor/state/document";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import { get } from "svelte/store";
import { beforeEach, describe, expect, it } from "vitest";

Object.assign(globalThis, { IDBKeyRange, indexedDB });

beforeEach(async () => {
	await storage.project.reset({ elements: "blank" });
	setProjectState(
		{
			id: "prod",
			name: "Grid persistence",
			elements: [],
			elementNameGrid: createElementNameGrid(),
			isElementNameImportOpen: true,
			initialized: true
		},
		"rescan"
	);
});

describe("element-name grid persistence", () => {
	it("rejects invalid live grid state", () => {
		expect(() => replaceElementNameGrid({ headers: ["Other"], rows: [[""]] })).toThrow("Name column");
	});

	it("saves grid edits in the existing IndexedDB project record", async () => {
		replaceElementNameGrid({
			headers: ["Name", "State"],
			rows: [
				["pump", "running"],
				["", ""]
			]
		});
		await flushEditorSave();

		const stored = await storage.project.fetch("prod");
		expect(stored.ok).toBe(true);
		if (!stored.ok) return;
		expect(stored.value.editorData.elementNameGrid).toEqual(get(projectState).elementNameGrid);

		setProjectState({ ...get(projectState), elementNameGrid: createElementNameGrid() }, "preserve");
		await loadEditorSession("prod");
		expect(get(projectState).elementNameGrid).toEqual(stored.value.editorData.elementNameGrid);
	});

	it("saves and reloads the import section state", async () => {
		setElementNameImportOpen(false);
		await flushEditorSave();
		setElementNameImportOpen(true);

		await loadEditorSession("prod");
		expect(get(projectState).isElementNameImportOpen).toBe(false);
	});

	it("clears the grid when the project resets", async () => {
		replaceElementNameGrid({ headers: ["Name"], rows: [["pump"], [""]] });
		const reset = await storage.project.reset({ elements: "blank" });

		expect(reset.ok).toBe(true);
		if (!reset.ok) return;
		expect(reset.value.editorData.elementNameGrid).toEqual(createElementNameGrid());
		expect(reset.value.isElementNameImportOpen).toBe(true);
	});
});
