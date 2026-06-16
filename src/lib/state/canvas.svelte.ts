const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 800;
const DEFAULT_ZOOM = 1;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;

type Camera = {
	x: number;
	y: number;
	zoom: number;
};

function clampZoom(value: number) {
	return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

function createCanvasState() {
	let width = $state(DEFAULT_WIDTH);
	let height = $state(DEFAULT_HEIGHT);
	let camera = $state<Camera>({ x: 0, y: 0, zoom: DEFAULT_ZOOM });

	function setSize(nextWidth: number, nextHeight: number) {
		width = Math.max(1, Math.round(nextWidth));
		height = Math.max(1, Math.round(nextHeight));
	}

	function setCamera(next: Partial<Camera>) {
		camera = {
			x: next.x ?? camera.x,
			y: next.y ?? camera.y,
			zoom: next.zoom === undefined ? camera.zoom : clampZoom(next.zoom)
		};
	}

	function pan(deltaX: number, deltaY: number) {
		setCamera({ x: camera.x + deltaX, y: camera.y + deltaY });
	}

	function zoomIn() {
		setCamera({ zoom: camera.zoom + 0.1 });
	}

	function zoomOut() {
		setCamera({ zoom: camera.zoom - 0.1 });
	}

	function resetZoom() {
		setCamera({ zoom: DEFAULT_ZOOM });
	}

	function centerCamera(containerWidth: number, containerHeight: number) {
		setCamera({
			x: -containerWidth / 2 + width / 2,
			y: -containerHeight / 2 + height / 2,
			zoom: DEFAULT_ZOOM
		});
	}

	return {
		get width() {
			return width;
		},
		get height() {
			return height;
		},
		get camera() {
			return camera;
		},
		get minZoom() {
			return MIN_ZOOM;
		},
		get maxZoom() {
			return MAX_ZOOM;
		},
		setSize,
		setCamera,
		pan,
		zoomIn,
		zoomOut,
		resetZoom,
		centerCamera
	};
}

export const canvasState = createCanvasState();
