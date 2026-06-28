import { Effect } from "effect";

import type { StoredImageAsset } from "../domain/image-assets";
import type { Project } from "../domain/project";
import { runApp } from "../runtime/browser-runtime";
import { ProjectRepo, type ResetProjectOptions } from "../services/project-repo";

export const DEFAULTS = {
	name: "maply",
	version: 4,
	store: "projects",
	imageAssetStore: "image-assets",
	projectId: "default",
	prodProjId: "prod"
};

function withRepo<A>(fn: (repo: ProjectRepo) => Effect.Effect<A, unknown>) {
	return Effect.gen(function* () {
		const repo = yield* ProjectRepo;
		return yield* fn(repo);
	});
}

export async function fetchProject(id: string): Promise<Project> {
	return runApp(withRepo((repo) => repo.fetchProject(id)));
}

export async function saveProject(project: Project): Promise<void> {
	return runApp(withRepo((repo) => repo.saveProject(project)));
}

export async function fetchImageAssets(ids: string[]): Promise<StoredImageAsset[]> {
	return runApp(withRepo((repo) => repo.fetchImageAssets(ids)));
}

export async function saveImageAsset(asset: StoredImageAsset): Promise<void> {
	return runApp(withRepo((repo) => repo.saveImageAsset(asset)));
}

export async function replaceProject(project: Project, imageAssets: StoredImageAsset[]): Promise<void> {
	return runApp(withRepo((repo) => repo.replaceProject(project, imageAssets)));
}

export async function deleteImageAsset(id: string): Promise<void> {
	return runApp(withRepo((repo) => repo.deleteImageAsset(id)));
}

export async function resetProdProject(options: ResetProjectOptions = {}): Promise<Project> {
	return runApp(withRepo((repo) => repo.resetProject(options)));
}
