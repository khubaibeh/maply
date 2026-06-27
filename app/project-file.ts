import type { StoredImageAsset } from "./domain/image-assets";
import type { Project } from "./domain/project";

export const PROJECT_FILE_FORMAT = "maply-project";
export const PROJECT_FILE_VERSION = 1;

export type ProjectFilePackage = {
	format: typeof PROJECT_FILE_FORMAT;
	version: typeof PROJECT_FILE_VERSION;
	project: Project;
	imageAssets: StoredImageAsset[];
};

export function createProjectFilePackage(project: Project, imageAssets: StoredImageAsset[]): ProjectFilePackage {
	return {
		format: PROJECT_FILE_FORMAT,
		version: PROJECT_FILE_VERSION,
		project: structuredClone(project),
		imageAssets: structuredClone(imageAssets)
	};
}
