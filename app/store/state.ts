import { appCanvasState } from "./canvas";
import { appFillState } from "./fill";
import { appImageAssetState } from "./image-assets";
import { appProjectState } from "./project";
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
	project: view(appProjectState),
	canvas: view(appCanvasState),
	fill: view(appFillState),
	tool: view(appToolState),
	imageAssets: view(appImageAssetState)
} as const;
