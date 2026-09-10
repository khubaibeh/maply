<script lang="ts">
	import { Editor, recordEditorFrame, recordEditorRender } from "editor";

	import type { CanvasSceneMetrics } from "./canvas-renderer";
	import { createCanvasScene } from "./canvas-renderer";

	type Props = {
		viewport: { x: number; y: number; width: number; height: number };
		width: number;
		height: number;
	};

	let { viewport, width, height }: Props = $props();
	let canvasElement = $state<HTMLCanvasElement>();
	let imageRevision = $state(0);
	let metrics = $state<CanvasSceneMetrics>({
		candidateElements: 0,
		renderedElements: 0,
		imageElements: 0,
		loadedImages: 0
	});

	const canvas = Editor.state.canvas;
	const documentRevision = Editor.state.documentRevision;
	const imageAssets = Editor.state.imageAssets;
	const scene = createCanvasScene();

	$effect(() => {
		const revision = $documentRevision;
		const currentCanvas = $canvas;
		const assets = $imageAssets;
		if (revision < 0 || imageRevision < 0 || !canvasElement || width <= 0 || height <= 0) return;

		const elements = Editor.document.query(viewport).flatMap((id) => {
			const element = Editor.document.get(id);
			return element ? [element] : [];
		});
		const startedAt = typeof performance === "undefined" ? 0 : performance.now();
		const nextMetrics = scene.render(canvasElement, {
			width,
			height,
			pixelRatio: typeof window === "undefined" ? 1 : window.devicePixelRatio,
			camera: currentCanvas.camera,
			surface: {
				x: currentCanvas.x,
				y: currentCanvas.y,
				width: currentCanvas.width,
				height: currentCanvas.height,
				color: currentCanvas.color
			},
			elements,
			assets,
			text: {
				wrappedLines: Editor.text.wrappedLines,
				wrappedLineHeight: Editor.text.wrappedLineHeight,
				wrappedMetrics: Editor.text.wrappedMetrics
			},
			onImageReady: () => {
				imageRevision += 1;
			}
		});
		metrics = nextMetrics;
		const durationMs = typeof performance === "undefined" ? 0 : performance.now() - startedAt;
		recordEditorRender("canvas", durationMs, nextMetrics.candidateElements, nextMetrics.renderedElements);
		recordEditorFrame(durationMs, nextMetrics.renderedElements);
	});

	$effect(() => {
		return () => scene.dispose();
	});
</script>

<canvas
	bind:this={canvasElement}
	class="pointer-events-none absolute inset-0 block h-full w-full"
	data-canvas-renderer="canvas"
	data-candidate-elements={metrics.candidateElements}
	data-rendered-elements={metrics.renderedElements}
	aria-hidden="true"
></canvas>
