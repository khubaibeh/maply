import { svg, validateMimeType } from "@maply/io";
import type { PreparedImage } from "@maply/io/types";
import type { StoredImageAsset } from "@maply/model/types";
import { storage } from "@maply/storage";
import { get } from "svelte/store";

import { createElementId } from "../elements/naming";
import { imageAssetState } from "../state/assets";
import { projectState } from "../state/document";
import { acquireMutex } from "../state/mutex";
import { canvasState } from "../state/workspace";
import { importExportState } from "./project-state";

export async function replaceImageAsset(id: string, asset: StoredImageAsset) {
	const release = await acquireMutex();
	try {
		const project = get(projectState);
		const assets = get(imageAssetState);
		const current = project.elements.find((element) => element.id === id);
		if (!current || current.type !== "image") {
			return { ok: false as const, error: new Error("Target element is not an image.") };
		}
		const nextAsset = { ...asset, id: createElementId(), projectId: project.id };
		const elements = project.elements.map((element) =>
			element.id === id && element.type === "image"
				? { ...element, assetId: nextAsset.id, href: undefined, cropX: 0, cropY: 0, cropScale: 100 }
				: element
		);
		const nextAssets = { ...assets, [nextAsset.id]: nextAsset };
		const referenced: StoredImageAsset[] = [];
		for (const element of elements) {
			if (element.type !== "image" || !element.assetId) continue;
			const entry = nextAssets[element.assetId];
			if (!entry) return { ok: false as const, error: new Error(`Missing image asset: ${element.assetId}`) };
			if (!referenced.some((candidate) => candidate.id === entry.id)) referenced.push(entry);
		}
		const canvas = get(canvasState);
		const result = await storage.project.replace(
			{
				id: project.id,
				name: project.name,
				canvas: { width: canvas.width, height: canvas.height, color: canvas.color, x: canvas.x, y: canvas.y },
				camera: { ...canvas.camera },
				elements,
				importExportState: { ...get(importExportState) }
			},
			referenced
		);
		if (!result.ok) return result;
		projectState.set({ ...project, elements });
		imageAssetState.set(Object.fromEntries(referenced.map((entry) => [entry.id, entry])));
		return { ok: true as const };
	} finally {
		release();
	}
}

export async function imageFromFile(id: string, file: File) {
	const mime = validateMimeType(file.type);
	if (!mime.ok) return { ok: false as const, error: { type: "UnsupportedFormat" as const, mimeType: file.type } };
	let prepared: PreparedImage;
	try {
		const dataUrl = mime.value.isSvg ? await prepareSvg(await read(file, "text")) : await read(file, "data-url");
		const dimensions = await imageDimensions(dataUrl);
		prepared = { name: file.name || "image", mimeType: mime.value.mimeType, dataUrl, ...dimensions };
	} catch (cause) {
		return { ok: false as const, error: { type: "ReadFailed" as const, cause } };
	}
	const result = await replaceImageAsset(id, { id: "", projectId: get(projectState).id, ...prepared });
	return result.ok
		? { ok: true as const, value: prepared }
		: { ok: false as const, error: { type: "AttachmentFailed" as const, cause: result.error } };
}

async function prepareSvg(markup: string): Promise<string> {
	const prepared = await svg.prepare(markup);
	if (!prepared.ok) throw new Error(prepared.error);
	return prepared.value.dataUrl;
}

function read(file: File, kind: "text" | "data-url"): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onerror = () => reject(reader.error ?? new Error("Failed to read file."));
		reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
		if (kind === "text") reader.readAsText(file);
		else reader.readAsDataURL(file);
	});
}

function imageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
	return new Promise((resolve, reject) => {
		const image = new Image();
		image.onload = () =>
			resolve({ width: image.naturalWidth || image.width, height: image.naturalHeight || image.height });
		image.onerror = () => reject(new Error("Failed to read image dimensions."));
		image.src = dataUrl;
	});
}
