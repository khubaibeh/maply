import { canvasState } from "$lib/app/state/canvas.svelte";
import { imageAssetState } from "$lib/app/state/image-assets.svelte";
import { projectState } from "$lib/app/state/project.svelte";
import { toolState } from "$lib/app/state/tool.svelte";
import { getTheme } from "$lib/app/theme.svelte";

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
	canvas: view(canvasState),
	tool: view(toolState),
	imageAssets: view(imageAssetState),
	theme: getTheme()
} as const;
