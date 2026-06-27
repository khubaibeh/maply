import { Effect } from "effect";

import { ProjectExportError } from "./errors/project-errors";
import { createProjectFilePackage } from "./project-file";
import { ProjectRepo, type ResetProjectOptions } from "./services/project-repo";

const PROD_ID = "prod";

export function createProject(options?: ResetProjectOptions) {
	return Effect.gen(function* () {
		const repo = yield* ProjectRepo;
		return yield* repo.resetProject(options);
	});
}

export function exportProject() {
	return Effect.gen(function* () {
		const repo = yield* ProjectRepo;
		const project = yield* repo.fetchProject(PROD_ID);
		const ids = Array.from(
			new Set(
				project.elements.flatMap((element) =>
					element.type === "image" && element.assetId ? [element.assetId] : []
				)
			)
		);
		const imageAssets = yield* repo.fetchImageAssets(ids);
		const assetIds = new Set(imageAssets.map((asset) => asset.id));

		for (const element of project.elements) {
			if (element.type !== "image" || !element.assetId || assetIds.has(element.assetId)) continue;
			yield* Effect.fail(
				new ProjectExportError({
					message: `Project export is missing image asset data for assetId ${element.assetId}.`
				})
			);
		}

		return createProjectFilePackage(project, imageAssets);
	});
}
