import { createDefaultProject } from "../domain/defaults";
import type { CircleElement, Element, ImageElement, PathElement, RectElement, TextElement } from "../domain/elements";
import type { StoredImageAsset } from "../domain/image-assets";
import type { Camera, Canvas, ImportExportState, Project } from "../domain/project";
import { sanitizeCanvasSize, validNumber } from "./canvas-actions";
import { normalizeElements } from "./element-actions";

export const PROJECT_FILE_FORMAT = "maply-project";
export const PROJECT_FILE_VERSION = 1;

export type ProjectFilePackage = {
	format: typeof PROJECT_FILE_FORMAT;
	version: typeof PROJECT_FILE_VERSION;
	project: Project;
	imageAssets: StoredImageAsset[];
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, message: string): string {
	if (typeof value !== "string") throw new Error(message);
	return value;
}

function requireBoolean(value: unknown, message: string): boolean {
	if (typeof value !== "boolean") throw new Error(message);
	return value;
}

function requireNumber(value: unknown, message: string): number {
	if (!validNumber(value)) throw new Error(message);
	return value;
}

function requireArray(value: unknown, message: string): unknown[] {
	if (!Array.isArray(value)) throw new Error(message);
	return value;
}

function validateCanvas(value: unknown): Canvas {
	if (!isRecord(value)) throw new Error("Project canvas must be an object.");
	return {
		width: sanitizeCanvasSize(requireNumber(value.width, "Project canvas width must be a number.")),
		height: sanitizeCanvasSize(requireNumber(value.height, "Project canvas height must be a number.")),
		color: requireString(value.color, "Project canvas color must be a string."),
		x: Math.round(requireNumber(value.x, "Project canvas x must be a number.")),
		y: Math.round(requireNumber(value.y, "Project canvas y must be a number."))
	};
}

function validateCamera(value: unknown): Camera | undefined {
	if (value === undefined) return undefined;
	if (!isRecord(value)) throw new Error("Project camera must be an object.");
	return {
		x: requireNumber(value.x, "Project camera x must be a number."),
		y: requireNumber(value.y, "Project camera y must be a number."),
		zoom: requireNumber(value.zoom, "Project camera zoom must be a number.")
	};
}

function validateImportExportState(value: unknown): ImportExportState {
	if (!isRecord(value)) throw new Error("Project import/export state must be an object.");
	return {
		importsOpen: requireBoolean(value.importsOpen, "Project importsOpen must be a boolean."),
		elementsOpen: requireBoolean(value.elementsOpen, "Project elementsOpen must be a boolean.")
	};
}

function validateRectElement(value: UnknownRecord): RectElement {
	return {
		id: requireString(value.id, "Rectangle id must be a string."),
		name: requireString(value.name, "Rectangle name must be a string."),
		type: "rect",
		x: Math.round(requireNumber(value.x, "Rectangle x must be a number.")),
		y: Math.round(requireNumber(value.y, "Rectangle y must be a number.")),
		width: requireNumber(value.width, "Rectangle width must be a number."),
		height: requireNumber(value.height, "Rectangle height must be a number."),
		fill: requireString(value.fill, "Rectangle fill must be a string."),
		stroke: requireString(value.stroke, "Rectangle stroke must be a string."),
		strokeWidth: requireNumber(value.strokeWidth, "Rectangle strokeWidth must be a number.")
	};
}

function validateCircleElement(value: UnknownRecord): CircleElement {
	return {
		id: requireString(value.id, "Circle id must be a string."),
		name: requireString(value.name, "Circle name must be a string."),
		type: "circle",
		cx: Math.round(requireNumber(value.cx, "Circle cx must be a number.")),
		cy: Math.round(requireNumber(value.cy, "Circle cy must be a number.")),
		r: requireNumber(value.r, "Circle r must be a number."),
		fill: requireString(value.fill, "Circle fill must be a string."),
		stroke: requireString(value.stroke, "Circle stroke must be a string."),
		strokeWidth: requireNumber(value.strokeWidth, "Circle strokeWidth must be a number.")
	};
}

function validatePathElement(value: UnknownRecord): PathElement {
	return {
		id: requireString(value.id, "Path id must be a string."),
		name: requireString(value.name, "Path name must be a string."),
		type: "path",
		x: Math.round(requireNumber(value.x, "Path x must be a number.")),
		y: Math.round(requireNumber(value.y, "Path y must be a number.")),
		d: requireString(value.d, "Path d must be a string."),
		fill: requireString(value.fill, "Path fill must be a string."),
		stroke: requireString(value.stroke, "Path stroke must be a string."),
		strokeWidth: requireNumber(value.strokeWidth, "Path strokeWidth must be a number."),
		closed: requireBoolean(value.closed, "Path closed must be a boolean.")
	};
}

function validateTextElement(value: UnknownRecord): TextElement {
	return {
		id: requireString(value.id, "Text id must be a string."),
		name: requireString(value.name, "Text name must be a string."),
		type: "text",
		x: Math.round(requireNumber(value.x, "Text x must be a number.")),
		y: Math.round(requireNumber(value.y, "Text y must be a number.")),
		width: requireNumber(value.width, "Text width must be a number."),
		height: requireNumber(value.height, "Text height must be a number."),
		text: requireString(value.text, "Text content must be a string."),
		fontSize: requireNumber(value.fontSize, "Text fontSize must be a number."),
		fill: requireString(value.fill, "Text fill must be a string.")
	};
}

function validateImageElement(value: UnknownRecord): ImageElement {
	const assetId = value.assetId;
	const href = value.href;
	return {
		id: requireString(value.id, "Image id must be a string."),
		name: requireString(value.name, "Image name must be a string."),
		type: "image",
		x: Math.round(requireNumber(value.x, "Image x must be a number.")),
		y: Math.round(requireNumber(value.y, "Image y must be a number.")),
		width: requireNumber(value.width, "Image width must be a number."),
		height: requireNumber(value.height, "Image height must be a number."),
		assetId: assetId === null ? null : requireString(assetId, "Image assetId must be a string or null."),
		href: href === undefined ? undefined : requireString(href, "Image href must be a string."),
		cropX: requireNumber(value.cropX, "Image cropX must be a number."),
		cropY: requireNumber(value.cropY, "Image cropY must be a number."),
		cropScale: requireNumber(value.cropScale, "Image cropScale must be a number.")
	};
}

function validateElement(value: unknown): Element {
	if (!isRecord(value)) throw new Error("Project element entries must be objects.");
	const type = requireString(value.type, "Project element type must be a string.");

	switch (type) {
		case "rect":
			return validateRectElement(value);
		case "circle":
			return validateCircleElement(value);
		case "path":
			return validatePathElement(value);
		case "text":
			return validateTextElement(value);
		case "image":
			return validateImageElement(value);
		default:
			throw new Error(`Unsupported element type: ${type}.`);
	}
}

function validateImageAsset(value: unknown): StoredImageAsset {
	if (!isRecord(value)) throw new Error("Project image asset entries must be objects.");
	return {
		id: requireString(value.id, "Image asset id must be a string."),
		projectId: requireString(value.projectId, "Image asset projectId must be a string."),
		name: requireString(value.name, "Image asset name must be a string."),
		mimeType: requireString(value.mimeType, "Image asset mimeType must be a string."),
		dataUrl: requireString(value.dataUrl, "Image asset dataUrl must be a string."),
		width: requireNumber(value.width, "Image asset width must be a number."),
		height: requireNumber(value.height, "Image asset height must be a number.")
	};
}

function validateProject(value: unknown): Project {
	if (!isRecord(value)) throw new Error("Project payload must be an object.");
	const defaults = createDefaultProject(requireString(value.id, "Project id must be a string."));
	const elements = normalizeElements(
		requireArray(value.elements, "Project elements must be an array.").map((element) => validateElement(element))
	);

	return {
		...defaults,
		name: requireString(value.name, "Project name must be a string."),
		canvas: validateCanvas(value.canvas),
		camera: validateCamera(value.camera),
		elements,
		importExportState: validateImportExportState(value.importExportState)
	};
}

function validateReferencedAssets(project: Project, imageAssets: StoredImageAsset[]) {
	const assetIds = new Map<string, StoredImageAsset>();

	for (const asset of imageAssets) {
		if (assetIds.has(asset.id)) {
			throw new Error(`Duplicate image asset id in project file: ${asset.id}.`);
		}

		assetIds.set(asset.id, asset);
	}

	for (const element of project.elements) {
		if (element.type !== "image" || !element.assetId) continue;
		if (!assetIds.has(element.assetId)) {
			throw new Error(`Project file is missing image asset data for assetId ${element.assetId}.`);
		}
	}
}

export function createProjectFilePackage(project: Project, imageAssets: StoredImageAsset[]): ProjectFilePackage {
	const normalizedProject = validateProject(project);
	const normalizedAssets = imageAssets.map((asset) => validateImageAsset(asset));
	validateReferencedAssets(normalizedProject, normalizedAssets);

	return {
		format: PROJECT_FILE_FORMAT,
		version: PROJECT_FILE_VERSION,
		project: structuredClone(normalizedProject),
		imageAssets: structuredClone(normalizedAssets)
	};
}

export function stringifyProjectFilePackage(projectFile: ProjectFilePackage): string {
	return JSON.stringify(projectFile, null, 2);
}

export function parseProjectFilePackage(text: string): ProjectFilePackage {
	let parsed: unknown;

	try {
		parsed = JSON.parse(text);
	} catch {
		throw new Error("Project file is not valid JSON.");
	}

	if (!isRecord(parsed)) throw new Error("Project file root must be an object.");

	if (parsed.format !== PROJECT_FILE_FORMAT) {
		throw new Error("Unsupported project file format.");
	}

	if (parsed.version !== PROJECT_FILE_VERSION) {
		throw new Error(`Unsupported project file version: ${String(parsed.version)}.`);
	}

	const project = validateProject(parsed.project);
	const imageAssets = requireArray(parsed.imageAssets, "Project imageAssets must be an array.").map((asset) =>
		validateImageAsset(asset)
	);
	validateReferencedAssets(project, imageAssets);

	return {
		format: PROJECT_FILE_FORMAT,
		version: PROJECT_FILE_VERSION,
		project,
		imageAssets
	};
}

export function toImportedProject(projectFile: ProjectFilePackage, projectId: string): ProjectFilePackage {
	// Import callers may pass reactive proxies, so normalize back into plain validated records first.
	const normalized = createProjectFilePackage(projectFile.project, projectFile.imageAssets);
	const project = structuredClone(normalized.project);
	const imageAssets = structuredClone(normalized.imageAssets).map((asset) => ({ ...asset, projectId }));

	project.id = projectId;

	return {
		format: normalized.format,
		version: normalized.version,
		project,
		imageAssets
	};
}
