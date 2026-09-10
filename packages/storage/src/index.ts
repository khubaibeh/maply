import {
	deleteImageAsset,
	fetchImageAssets,
	fetchProject,
	saveIncrementalProject,
	replaceProject,
	resetProject,
	saveImageAsset,
	saveProject
} from "./effect/program";

export const storage = {
	project: {
		fetch: fetchProject,
		save: saveProject,
		saveIncremental: saveIncrementalProject,
		replace: replaceProject,
		reset: resetProject
	},
	imageAsset: {
		fetch: fetchImageAssets,
		save: saveImageAsset,
		delete: deleteImageAsset
	}
} as const;
