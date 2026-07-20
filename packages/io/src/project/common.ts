import { ProjectSchema, StoredImageAssetSchema } from "@maply/model/effect";
import type { Project, StoredImageAsset } from "@maply/model/types";
import { Effect, Schema } from "effect";

import {
	ProjectFileAssetReferenceError,
	ProjectFileSchemaError,
	type ProjectFileOperation,
	type ProjectFileSection
} from "./errors";
import { getAssetReferenceIssue, normalizeProject } from "./utils";

export const PROJECT_FILE_FORMAT = "maply-project";
export const PROJECT_FILE_VERSION = 1;

export type ProjectFilePackage = {
	format: typeof PROJECT_FILE_FORMAT;
	version: typeof PROJECT_FILE_VERSION;
	project: Project;
	imageAssets: readonly StoredImageAsset[];
};

const ProjectFilePackageSchema = Schema.Struct({
	format: Schema.Literal(PROJECT_FILE_FORMAT),
	version: Schema.Literal(PROJECT_FILE_VERSION),
	project: ProjectSchema,
	imageAssets: Schema.Array(StoredImageAssetSchema)
});

const decodeProject = Schema.decodeUnknownEffect(ProjectSchema);
const decodeImageAsset = Schema.decodeUnknownEffect(StoredImageAssetSchema);

export const decodeProjectFilePackage = Schema.decodeUnknownEffect(ProjectFilePackageSchema);

export function schemaError(operation: ProjectFileOperation, section: ProjectFileSection) {
	return (error: { message: string }) =>
		new ProjectFileSchemaError({ operation, section, message: error.message, details: { cause: error } });
}

function validateAssetRefs(
	operation: ProjectFileOperation,
	project: Project,
	imageAssets: readonly StoredImageAsset[]
) {
	const issue = getAssetReferenceIssue(project, imageAssets);
	if (!issue) return Effect.void;

	if (issue.type === "duplicateAsset") {
		return Effect.fail(
			new ProjectFileAssetReferenceError({
				operation,
				reason: "duplicate",
				assetId: issue.assetId,
				message: `Duplicate image asset id in project file: ${issue.assetId}.`
			})
		);
	}

	return Effect.fail(
		new ProjectFileAssetReferenceError({
			operation,
			reason: "missing",
			assetId: issue.assetId,
			elementId: issue.elementId,
			message: `Project file is missing image asset data for assetId ${issue.assetId}.`
		})
	);
}

/**
 * Normalizes legacy-tolerant model values, then decodes the result again before returning it.
 * This keeps compatibility repairs at the file boundary while callers receive schema-valid data.
 */
export function normalizePackage(
	operation: ProjectFileOperation,
	project: Project,
	imageAssets: readonly StoredImageAsset[]
): Effect.Effect<ProjectFilePackage, ProjectFileSchemaError | ProjectFileAssetReferenceError> {
	return Effect.gen(function* () {
		// Normalize project-specific derived fields before validating its current schema.
		const normalizedProject = yield* decodeProject(normalizeProject(project)).pipe(
			Effect.mapError(schemaError(operation, "project"))
		);

		// Decode each asset independently to report the failing section precisely.
		const normalizedAssets = yield* Effect.forEach(imageAssets, (asset) =>
			decodeImageAsset(asset).pipe(Effect.mapError(schemaError(operation, "asset")))
		);

		// References are valid only after both the project and assets have been normalized.
		yield* validateAssetRefs(operation, normalizedProject, normalizedAssets);

		return {
			format: PROJECT_FILE_FORMAT,
			version: PROJECT_FILE_VERSION,
			project: normalizedProject,
			imageAssets: normalizedAssets
		};
	});
}
