import type { StoredImageAsset } from "../domain/image-assets";
import {
	parseProjectFilePackage,
	PROJECT_FILE_FORMAT,
	PROJECT_FILE_VERSION,
	type ProjectFilePackage
} from "./project-file";

const SVG_RECOVERY_FORMAT = "maply-svg-recovery";
const SVG_RECOVERY_VERSION = 1;
const RECOVERY_METADATA_ID = "maply-recovery";

type SvgImportMetadata = {
	format: typeof SVG_RECOVERY_FORMAT;
	version: typeof SVG_RECOVERY_VERSION;
	projectId: string;
	project: unknown;
	imageAssets: Array<{
		id: string;
		name: string;
		mimeType: string;
		width: number;
		height: number;
	}>;
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, message: string): string {
	if (typeof value !== "string") throw new Error(message);
	return value;
}

function requireNumber(value: unknown, message: string): number {
	if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(message);
	return value;
}

function requireArray(value: unknown, message: string): unknown[] {
	if (!Array.isArray(value)) throw new Error(message);
	return value;
}

function decodeXml(value: string) {
	return value
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&amp;/g, "&");
}

function extractRecoveryMetadata(svg: string): string {
	const match = svg.match(
		new RegExp(
			`<metadata\\b[^>]*\\bid\\s*=\\s*(["'])${RECOVERY_METADATA_ID}\\1[^>]*>([\\s\\S]*?)<\\/metadata>`,
			"i"
		)
	);
	if (!match) {
		throw new Error("SVG does not contain Maply recovery metadata.");
	}

	const raw = match[2]?.trim() ?? "";
	const cdata = raw.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
	return (cdata ? cdata[1] : decodeXml(raw)).replace(/]]<!\[CDATA\[/g, "]]>");
}

function parseMetadata(svg: string): SvgImportMetadata {
	const metadataText = extractRecoveryMetadata(svg);
	let parsed: unknown;

	try {
		parsed = JSON.parse(metadataText);
	} catch {
		throw new Error("SVG recovery metadata is not valid JSON.");
	}

	if (!isRecord(parsed)) throw new Error("SVG recovery metadata root must be an object.");
	if (parsed.format !== SVG_RECOVERY_FORMAT) {
		throw new Error("Unsupported SVG recovery format.");
	}
	if (parsed.version !== SVG_RECOVERY_VERSION) {
		throw new Error(`Unsupported SVG recovery version: ${String(parsed.version)}.`);
	}

	return {
		format: SVG_RECOVERY_FORMAT,
		version: SVG_RECOVERY_VERSION,
		projectId: isRecord(parsed.project)
			? requireString(parsed.project.id, "SVG recovery project id must be a string.")
			: (() => {
					throw new Error("SVG recovery project payload must be an object.");
				})(),
		project: parsed.project,
		imageAssets: requireArray(parsed.imageAssets, "SVG recovery imageAssets must be an array.").map((value) => {
			if (!isRecord(value)) throw new Error("SVG recovery image asset entries must be objects.");
			return {
				id: requireString(value.id, "SVG recovery image asset id must be a string."),
				name: requireString(value.name, "SVG recovery image asset name must be a string."),
				mimeType: requireString(value.mimeType, "SVG recovery image asset mimeType must be a string."),
				width: requireNumber(value.width, "SVG recovery image asset width must be a number."),
				height: requireNumber(value.height, "SVG recovery image asset height must be a number.")
			};
		})
	};
}

function parseAttributes(tag: string) {
	const attrs = new Map<string, string>();
	const attrPattern = /([:\w-]+)\s*=\s*(["'])([\s\S]*?)\2/g;

	for (const match of tag.matchAll(attrPattern)) {
		attrs.set(match[1], decodeXml(match[3]));
	}

	return attrs;
}

function extractAssetDataUrls(svg: string) {
	const dataUrls = new Map<string, string>();
	const imageTagPattern = /<image\b[^>]*\/?>(?:<\/image>)?/gi;

	for (const match of svg.matchAll(imageTagPattern)) {
		const attrs = parseAttributes(match[0]);
		const assetId = attrs.get("data-maply-asset-id");
		const href = attrs.get("href") ?? attrs.get("xlink:href");
		if (!assetId || !href) continue;
		if (!href.startsWith("data:")) {
			throw new Error(`SVG recovery asset ${assetId} is not embedded as a data URL.`);
		}

		const previous = dataUrls.get(assetId);
		if (previous && previous !== href) {
			throw new Error(`SVG recovery asset ${assetId} has conflicting embedded data.`);
		}

		dataUrls.set(assetId, href);
	}

	return dataUrls;
}

function buildImageAssets(metadata: SvgImportMetadata, assetDataUrls: Map<string, string>): StoredImageAsset[] {
	return metadata.imageAssets.map((asset) => {
		const dataUrl = assetDataUrls.get(asset.id);
		if (!dataUrl) {
			throw new Error(`SVG recovery data is missing embedded image asset ${asset.id}.`);
		}

		return {
			...asset,
			projectId: metadata.projectId,
			dataUrl
		};
	});
}

export function parseSvgProjectFilePackage(svg: string): ProjectFilePackage {
	const metadata = parseMetadata(svg);
	const imageAssets = buildImageAssets(metadata, extractAssetDataUrls(svg));
	return parseProjectFilePackage(
		JSON.stringify({
			format: PROJECT_FILE_FORMAT,
			version: PROJECT_FILE_VERSION,
			project: metadata.project,
			imageAssets
		})
	);
}
