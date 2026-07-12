import { project as ioProject, svg } from "@maply/io";
import type { SvgOptions } from "@maply/io/types";
import { storage } from "@maply/storage";
import { get } from "svelte/store";

import { imageAssetState } from "../state/assets";
import { projectState } from "../state/document";
import { canvasState } from "../state/workspace";
import { importExportState } from "./project-state";
import { loadEditorSession } from "./session";

export async function create(options: { elements?: "sample" | "blank" } = {}) {
	const result = await storage.project.reset(options);
	if (!result.ok) {
		console.warn("Failed to reset project:", result.error);
		return result;
	}
	await loadEditorSession(result.value.id);
	return { ok: true as const, value: undefined };
}

export async function exportProject() {
	const state = get(projectState);
	const canvas = get(canvasState);
	const assets = get(imageAssetState);
	const project = {
		id: state.id,
		name: state.name,
		canvas: { width: canvas.width, height: canvas.height, color: canvas.color, x: canvas.x, y: canvas.y },
		camera: { ...canvas.camera },
		elements: state.elements.map((element) => ({ ...element })),
		importExportState: { ...get(importExportState) }
	};
	const ids = project.elements.flatMap((element) =>
		element.type === "image" && element.assetId ? [element.assetId] : []
	);
	const referenced = ids.map((id) => assets[id]);
	const missing = referenced.findIndex((asset) => asset === undefined);
	if (missing !== -1) return { ok: false as const, error: new Error(`Missing image asset: ${ids[missing]}`) };
	return ioProject.file.create(
		project,
		referenced.filter((asset) => asset !== undefined)
	);
}

export async function importProject(file: Parameters<typeof ioProject.file.assign>[0]) {
	const id = get(projectState).id;
	const assigned = await ioProject.file.assign(file, id);
	if (!assigned.ok) return { ok: false as const, error: assigned.error };
	const replaced = await storage.project.replace(assigned.value.project, assigned.value.imageAssets);
	if (!replaced.ok) return { ok: false as const, error: replaced.error };
	await loadEditorSession(id);
	return { ok: true as const };
}

export async function exportSvg(options?: SvgOptions) {
	const file = await exportProject();
	if (!file.ok) return file;
	return svg.export(file.value.project, file.value.imageAssets, options);
}

export async function importSvg(markup: string) {
	const imported = await svg.import(markup);
	if (!imported.ok) return { ok: false as const, error: imported.error };
	const applied = await importProject(imported.value.file);
	if (!applied.ok) return applied;
	return { ok: true as const, source: imported.value.source, warnings: imported.value.warnings };
}
