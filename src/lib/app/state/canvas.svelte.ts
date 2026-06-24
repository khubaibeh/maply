import { get, writable } from "svelte/store";

import { CONSTANTS, mergeCamera, sanitizeCanvasSize } from "../core/canvas-actions";
import type { Camera } from "../domain/project";

type CanvasState = {
	width: number;
	height: number;
	color: string;
	x: number;
	y: number;
	camera: Camera;
	minZoom: number;
	maxZoom: number;
};

const store = writable<CanvasState>({
	width: CONSTANTS.width,
	height: CONSTANTS.height,
	color: "#ffffff",
	x: 0,
	y: 0,
	camera: { x: 0, y: 0, zoom: CONSTANTS.zoom },
	minZoom: CONSTANTS.min_zoom,
	maxZoom: CONSTANTS.max_zoom
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

	setColor(nextColor: string) {
		store.update((state) => ({ ...state, color: nextColor }));
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
		this.setCamera({ zoom: CONSTANTS.zoom });
	},

	resetCamera() {
		store.update((state) => ({ ...state, camera: { x: 0, y: 0, zoom: CONSTANTS.zoom } }));
	},

	centerCamera(containerWidth: number, containerHeight: number) {
		const state = get(store);
		this.setCamera({
			x: -containerWidth / 2 + state.x + state.width / 2,
			y: -containerHeight / 2 + state.y + state.height / 2,
			zoom: CONSTANTS.zoom
		});
	}
};
