import type { Project, StoredImageAsset } from "@maply/model/types";
import { Effect } from "effect";

import { normalizePackage, type ProjectFilePackage } from "./common";
import { ProjectFileAssetReferenceError, ProjectFileSchemaError, ProjectFileSerializeError } from "./errors";

export function create(
	project: Project,
	imageAssets: readonly StoredImageAsset[]
): Effect.Effect<ProjectFilePackage, ProjectFileSchemaError | ProjectFileAssetReferenceError> {
	return normalizePackage("create", project, imageAssets);
}

export function serialize(
	projectFile: ProjectFilePackage
): Effect.Effect<string, ProjectFileSchemaError | ProjectFileAssetReferenceError | ProjectFileSerializeError> {
	return Effect.gen(function* () {
		const normalized = yield* normalizePackage("stringify", projectFile.project, projectFile.imageAssets);

		return yield* Effect.try({
			try: () => JSON.stringify(normalized, null, 2),
			catch: (error) =>
				new ProjectFileSerializeError({
					operation: "stringify",
					message: error instanceof Error ? error.message : String(error),
					details: { cause: error }
				})
		});
	});
}
