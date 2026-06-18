import {
	DEFAULT_CANVAS_HEIGHT,
	DEFAULT_CANVAS_WIDTH,
	DEFAULT_ZOOM,
	MAX_ZOOM,
	MIN_ZOOM,
	mergeCamera,
	sanitizeCanvasSize
} from "$lib/editor/actions/canvas-actions";
import type { Camera } from "$lib/editor/model/project";
import { get, writable } from "svelte/store";

type CanvasState = {
	width: number;
	height: number;
	x: number;
	y: number;
	camera: Camera;
	minZoom: number;
	maxZoom: number;
};

const store = writable<CanvasState>({
	width: DEFAULT_CANVAS_WIDTH,
	height: DEFAULT_CANVAS_HEIGHT,
	x: 0,
	y: 0,
	camera: { x: 0, y: 0, zoom: DEFAULT_ZOOM },
	minZoom: MIN_ZOOM,
	maxZoom: MAX_ZOOM
});

export const canvasState = {
	subscribe: store.subscribe,

	getSnapshot() {
		return get(store);
	},

	setSize(nextWidth: number, nextHeight: number) {
		store.update((state) => ({
			...state,
			width: sanitizeCanvasSize(nextWidth),
			height: sanitizeCanvasSize(nextHeight)
		}));
	},

	setPosition(nextX: number, nextY: number) {
		store.update((state) => ({ ...state, x: nextX, y: nextY }));
	},

	setCamera(next: Partial<Camera>) {
		store.update((state) => ({ ...state, camera: mergeCamera(state.camera, next) }));
	},

	pan(deltaX: number, deltaY: number) {
		const state = get(store);
		this.setCamera({ x: state.camera.x + deltaX, y: state.camera.y + deltaY });
	},

	zoomIn() {
		this.setCamera({ zoom: get(store).camera.zoom + 0.1 });
	},

	zoomOut() {
		this.setCamera({ zoom: get(store).camera.zoom - 0.1 });
	},

	resetZoom() {
		this.setCamera({ zoom: DEFAULT_ZOOM });
	},

	resetCamera() {
		store.update((state) => ({ ...state, camera: { x: 0, y: 0, zoom: DEFAULT_ZOOM } }));
	},

	centerCamera(containerWidth: number, containerHeight: number) {
		const state = get(store);
		this.setCamera({
			x: -containerWidth / 2 + state.x + state.width / 2,
			y: -containerHeight / 2 + state.y + state.height / 2,
			zoom: DEFAULT_ZOOM
		});
	}
};
