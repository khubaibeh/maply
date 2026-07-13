import { project as projectIo, svg as svgIo } from "@maply/io";
import type { ProjectFilePackage } from "@maply/io/types";
import { Editor } from "editor";
import { fromStore } from "svelte/store";

import { downloadName, downloadText } from "./browser-download";

type BusyOperation = "project-import" | "project-export" | "svg-export";

/** Owns browser project transfer state while delegating editing workflows to Editor.project. */
export function createProjectTransfer() {
	const project = fromStore(Editor.state.project);
	const state = $state({
		busy: null as BusyOperation | null,
		importOpen: false,
		pending: null as ProjectFilePackage | null,
		pendingName: "",
		source: null as "generic" | "recovery" | "synoptic" | null,
		warnings: [] as string[],
		error: null as string | null
	});

	function fail(message: string) {
		state.error = message;
	}

	async function exportProject() {
		if (state.busy) return;
		state.busy = "project-export";
		state.error = null;
		try {
			const file = await Editor.project.export();
			if (!file.ok) return fail("The project could not be prepared for export.");
			const serialized = await projectIo.file.serialize(file.value);
			if (!serialized.ok) return fail("The project file could not be serialized.");
			downloadText(downloadName(file.value.project.name, "json"), serialized.value, "application/json");
		} catch {
			fail("The project export failed unexpectedly.");
		} finally {
			state.busy = null;
		}
	}

	async function exportSvg() {
		if (state.busy) return;
		state.busy = "svg-export";
		state.error = null;
		try {
			const svg = await Editor.project.exportSvg();
			if (!svg.ok) return fail("The SVG could not be prepared for export.");
			downloadText(downloadName(project.current.name, "svg"), svg.value, "image/svg+xml");
		} catch {
			fail("The SVG export failed unexpectedly.");
		} finally {
			state.busy = null;
		}
	}

	function stage(file: ProjectFilePackage, name: string) {
		state.pending = file;
		state.pendingName = name;
		state.importOpen = true;
	}

	async function stageProject(file: File) {
		if (state.busy) return;
		state.busy = "project-import";
		state.error = null;
		state.source = null;
		state.warnings = [];
		try {
			const parsed = await projectIo.file.parse(await file.text());
			if (!parsed.ok) return fail("The selected project file is invalid or unsupported.");
			stage(parsed.value, file.name);
		} catch {
			fail("The selected project file could not be read.");
		} finally {
			state.busy = null;
		}
	}

	async function stageSvg(file: File) {
		if (state.busy) return;
		state.busy = "project-import";
		state.error = null;
		try {
			const imported = await svgIo.import(await file.text());
			if (!imported.ok) return fail("The selected SVG is invalid or unsupported.");
			state.source = imported.value.source;
			state.warnings = imported.value.warnings.map((warning) => warning.message);
			stage(imported.value.file, file.name);
		} catch {
			fail("The selected SVG could not be read.");
		} finally {
			state.busy = null;
		}
	}

	function cancelImport() {
		state.importOpen = false;
		state.pending = null;
		state.pendingName = "";
		state.source = null;
		state.warnings = [];
	}

	async function confirmImport() {
		if (!state.pending || state.busy) return;
		state.busy = "project-import";
		state.error = null;
		try {
			const result = await Editor.project.import(state.pending);
			if (!result.ok) return fail("The imported project could not be saved.");
			cancelImport();
			window.location.reload();
		} catch {
			fail("The project import failed unexpectedly.");
		} finally {
			state.busy = null;
		}
	}

	return { state, exportProject, exportSvg, stageProject, stageSvg, cancelImport, confirmImport };
}
