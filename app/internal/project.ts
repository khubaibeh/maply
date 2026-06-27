import { Effect } from "effect";

import type { StoredImageAsset } from "../domain/image-assets";
import type { Project } from "../domain/project";
import { ProjectExportError, ProjectImportError, ProjectSvgError } from "../errors/project-errors";
import { ProjectRepo, type ResetProjectOptions } from "../services/project-repo";
import { createProjectFilePackage, type ProjectFilePackage, toImportedProject } from "./project-file";
import { exportProjectSvg } from "./svg-export";

const PROD_ID = "prod";

function loadProjectForExport() {
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
		return { project, imageAssets };
	});
}

function getMissingReferencedAssetId(project: Project, imageAssets: StoredImageAsset[]) {
	const assetIds = new Set(imageAssets.map((asset) => asset.id));

	for (const element of project.elements) {
		if (element.type !== "image" || !element.assetId || assetIds.has(element.assetId)) continue;
		return element.assetId;
	}

	return null;
}

export function createProject(options?: ResetProjectOptions) {
	return Effect.gen(function* () {
		const repo = yield* ProjectRepo;
		return yield* repo.resetProject(options);
	});
}

export function importProject(projectFile: ProjectFilePackage) {
	return Effect.gen(function* () {
		const repo = yield* ProjectRepo;
		const imported = yield* Effect.try({
			try: () => toImportedProject(projectFile, PROD_ID),
			catch: (error) =>
				new ProjectImportError({
					message: error instanceof Error ? error.message : String(error)
				})
		});

		yield* repo.replaceProject(imported.project, imported.imageAssets);
		return imported.project;
	});
}

export function exportProject() {
	return Effect.gen(function* () {
		const { project, imageAssets } = yield* loadProjectForExport();
		const missingAssetId = getMissingReferencedAssetId(project, imageAssets);
		if (missingAssetId) {
			yield* Effect.fail(
				new ProjectExportError({
					message: `Project export is missing image asset data for assetId ${missingAssetId}.`
				})
			);
		}

		return createProjectFilePackage(project, imageAssets);
	});
}

export function svgProject() {
	return Effect.gen(function* () {
		const { project, imageAssets } = yield* loadProjectForExport();
		const missingAssetId = getMissingReferencedAssetId(project, imageAssets);
		if (missingAssetId) {
			yield* Effect.fail(
				new ProjectSvgError({
					message: `Project export is missing image asset data for assetId ${missingAssetId}.`
				})
			);
		}

		return yield* Effect.tryPromise({
			try: () => exportProjectSvg(project, imageAssets),
			catch: (error) =>
				new ProjectSvgError({
					message: error instanceof Error ? error.message : String(error)
				})
		});
	});
}
