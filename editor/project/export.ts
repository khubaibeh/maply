import { project as ioProject } from "@maply/io";
import { get } from "svelte/store";

import { imageAssetState } from "../state/assets";
import { projectState } from "../state/document";
import { canvasState } from "../state/workspace";

/** Creates a portable project-file payload from the current editor session. */
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
		importExportState: { importsOpen: true, elementsOpen: true }
	};

	const referencedIds = project.elements.flatMap((element) =>
		element.type === "image" && element.assetId ? [element.assetId] : []
	);

	const referenced = referencedIds.map((id) => assets[id]);
	const missingIndex = referenced.findIndex((asset) => asset === undefined);

	if (missingIndex !== -1) {
		return { ok: false as const, error: new Error(`Missing image asset: ${referencedIds[missingIndex]}`) };
	}

	return ioProject.file.create(
		project,
		referenced.filter((asset) => asset !== undefined)
	);
}
