import { imageAssetState } from "$lib/app/state/image-assets.svelte";
import { projectState } from "$lib/app/state/project.svelte";

import { appCanvasState } from "./canvas";
import { appToolState } from "./tool";

type ReadonlyState<T> = {
	subscribe: (run: (value: T) => void, invalidate?: (value?: T) => void) => () => void;
};

function view<T>(state: ReadonlyState<T>) {
	return {
		subscribe: state.subscribe
	};
}

export const appState = {
	project: view(projectState),
	canvas: view(appCanvasState),
	tool: view(appToolState),
	imageAssets: view(imageAssetState)
} as const;
