import type { StoredImageAsset } from "@maply/model/types";
import { Effect } from "effect";

import { PROJECT_FILE_FORMAT, PROJECT_FILE_VERSION } from "../../project/common";
import { parse } from "../../project/import";
import { SvgRecoveryAssetError, SvgRecoveryFormatError, SvgRecoveryMetadataError } from "../errors";
import type { SvgImport } from "../types";
import { attributes, decodeXml, isRecord } from "./common";

const RECOVERY_FORMAT = "maply-svg-recovery";
const RECOVERY_VERSION = 1;
const RECOVERY_METADATA_ID = "maply-recovery";

/**
 * Extracts the recovery metadata JSON from the <metadata id="maply-recovery"> block.
 * The payload may be wrapped in CDATA to avoid XML escaping issues. When CDATA is split
 * across chunks (large payloads), the `]]>` markers inside the JSON are re-joined before parsing.
 */
function recoveryMetadata(svg: string) {
	return Effect.gen(function* () {
		const match = svg.match(
			new RegExp(
				`<metadata\\b[^>]*\\bid\\s*=\\s*(["'])${RECOVERY_METADATA_ID}\\1[^>]*>([\\s\\S]*?)<\\/metadata>`,
				"i"
			)
		);
		if (!match) return null;

		const raw = match[2]?.trim() ?? "";
		return yield* Effect.try({
			try: () =>
				JSON.parse(
					(raw.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/)?.[1] ?? decodeXml(raw)).replace(/]]<!\[CDATA\[/g, "]]>")
				) as unknown,
			catch: (cause) =>
				new SvgRecoveryMetadataError({
					message: "SVG recovery metadata is not valid JSON.",
					details: { cause }
				})
		});
	});
}

/**
 * Parses SVG recovery data — the lossless round-trip format Maply embeds in exported SVGs.
 * Returns null if the SVG has no recovery metadata block.
 *
 * Three phases:
 * 1. Validate metadata envelope (format, version, required fields)
 * 2. Extract embedded image data URLs from <image data-maply-asset-id="..."> tags
 * 3. Reassemble StoredImageAsset records by matching metadata entries to their data URLs
 */
function parseRecovery(svg: string) {
	return Effect.gen(function* () {
		const metadata = yield* recoveryMetadata(svg);
		if (metadata === null) return null;

		/* Phase 1: metadata envelope validation */
		if (!isRecord(metadata))
			return yield* Effect.fail(
				new SvgRecoveryFormatError({ message: "SVG recovery metadata root must be an object." })
			);
		if (metadata.format !== RECOVERY_FORMAT)
			return yield* Effect.fail(new SvgRecoveryFormatError({ message: "Unsupported SVG recovery format." }));
		if (metadata.version !== RECOVERY_VERSION)
			return yield* Effect.fail(
				new SvgRecoveryFormatError({
					message: `Unsupported SVG recovery version: ${String(metadata.version)}.`
				})
			);

		const projectId = isRecord(metadata.project) ? metadata.project.id : undefined;
		if (typeof projectId !== "string")
			return yield* Effect.fail(
				new SvgRecoveryFormatError({ message: "SVG recovery project payload must include a string id." })
			);
		if (!Array.isArray(metadata.imageAssets))
			return yield* Effect.fail(
				new SvgRecoveryFormatError({ message: "SVG recovery imageAssets must be an array." })
			);

		/*
		 * Phase 2: collect data URLs from <image> tags.
		 * Assets are stored as inline data URLs (not external hrefs) so the SVG is fully self-contained.
		 * Each <image> is tagged with data-maply-asset-id to link it back to its metadata entry.
		 */
		const urls = new Map<string, string>();
		for (const match of svg.matchAll(/<image\b[^>]*\/?>(?:<\/image>)?/gi)) {
			const attrs = attributes(match[0]);
			const assetId = attrs.get("data-maply-asset-id");
			const href = attrs.get("href") ?? attrs.get("xlink:href");
			if (!assetId || !href) continue;

			if (!href.startsWith("data:"))
				return yield* Effect.fail(
					new SvgRecoveryAssetError({
						assetId,
						message: `SVG recovery asset ${assetId} is not embedded as a data URL.`
					})
				);

			if (urls.has(assetId) && urls.get(assetId) !== href)
				return yield* Effect.fail(
					new SvgRecoveryAssetError({
						assetId,
						message: `SVG recovery asset ${assetId} has conflicting embedded data.`
					})
				);

			urls.set(assetId, href);
		}

		/* Phase 3: pair each metadata asset entry with its extracted data URL */
		const imageAssets: StoredImageAsset[] = [];
		for (const asset of metadata.imageAssets) {
			if (
				!isRecord(asset) ||
				typeof asset.id !== "string" ||
				typeof asset.name !== "string" ||
				typeof asset.mimeType !== "string" ||
				typeof asset.width !== "number" ||
				typeof asset.height !== "number"
			)
				return yield* Effect.fail(
					new SvgRecoveryFormatError({ message: "SVG recovery image asset entries are invalid." })
				);

			const dataUrl = urls.get(asset.id);
			if (!dataUrl)
				return yield* Effect.fail(
					new SvgRecoveryAssetError({
						assetId: asset.id,
						message: `SVG recovery data is missing embedded image asset ${asset.id}.`
					})
				);

			imageAssets.push({
				id: asset.id,
				projectId,
				name: asset.name,
				mimeType: asset.mimeType,
				width: asset.width,
				height: asset.height,
				dataUrl
			});
		}

		return { project: metadata.project, imageAssets };
	});
}

export function importRecovery(svg: string) {
	return parseRecovery(svg).pipe(
		Effect.flatMap((value) =>
			value === null
				? Effect.succeed(null)
				: parse(JSON.stringify({ format: PROJECT_FILE_FORMAT, version: PROJECT_FILE_VERSION, ...value })).pipe(
						Effect.map((file) => ({ file, source: "recovery" as const, warnings: [] }) satisfies SvgImport)
					)
		)
	);
}
