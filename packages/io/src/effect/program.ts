import type { Project, StoredImageAsset } from "@maply/model/types";
import { Cause, Effect, Exit } from "effect";

import { isSvgMimeType, svgToDataUrl, validateImageMimeType, validateSvgMarkup } from "../image/prepare";
import type { ProjectFilePackage } from "../project/common";
import { create, serialize } from "../project/export";
import { assign, parse } from "../project/import";
import { exportSvg } from "../svg/export";
import { importSvg } from "../svg/import";
import type { SvgOptions } from "../svg/types";
import { ioRuntime } from "./runtime";

export type IoResult<A, E> = { ok: true; value: A } | { ok: false; error: E };

function handled<A, E, R>(effect: Effect.Effect<A, E, R>): Promise<IoResult<A, E>> {
	return ioRuntime.runPromise(
		(effect as Effect.Effect<A, E, never>).pipe(
			Effect.match({
				onFailure: (error): IoResult<A, E> => ({ ok: false, error }),
				onSuccess: (value): IoResult<A, E> => ({ ok: true, value })
			})
		)
	);
}

export type MimeValidationResult =
	{ ok: true; value: { mimeType: string; isSvg: boolean } } | { ok: false; error: string };

export function validateMimeType(mimeType: string): MimeValidationResult {
	const exit = Effect.runSyncExit(validateImageMimeType(mimeType));

	if (Exit.isFailure(exit)) {
		const error = Cause.squash(exit.cause);

		return {
			ok: false,
			error: error instanceof Error ? error.message : String((error as { message?: string }).message ?? error)
		};
	}

	return { ok: true, value: { mimeType: exit.value, isSvg: isSvgMimeType(exit.value) } };
}

export type SvgPrepareResult =
	{ ok: true; value: { sanitized: string; dataUrl: string } } | { ok: false; error: string };

export function prepareSvg(markup: string): SvgPrepareResult {
	const exit = Effect.runSyncExit(validateSvgMarkup(markup));

	if (Exit.isFailure(exit)) {
		const error = Cause.squash(exit.cause);
		return {
			ok: false,
			error: error instanceof Error ? error.message : String((error as { message?: string }).message ?? error)
		};
	}

	const sanitized = exit.value;

	return { ok: true, value: { sanitized, dataUrl: svgToDataUrl(sanitized) } };
}

export function createProject(project: Project, imageAssets: readonly StoredImageAsset[]) {
	return handled(create(project, imageAssets));
}

export function serializeProject(projectFile: ProjectFilePackage) {
	return handled(serialize(projectFile));
}

export function parseProject(text: string) {
	return handled(parse(text));
}

export function assignProject(projectFile: ProjectFilePackage, projectId: string) {
	return handled(assign(projectFile, projectId));
}

export function exportSvgProject(project: Project, imageAssets: readonly StoredImageAsset[], options?: SvgOptions) {
	return handled(exportSvg(project, imageAssets, options));
}

export function importSvgProject(svg: string) {
	return handled(importSvg(svg));
}
