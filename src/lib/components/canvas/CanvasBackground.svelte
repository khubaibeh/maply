<script lang="ts">
	interface Props {
		camera: { x: number; y: number; zoom: number };
		containerWidth: number;
		containerHeight: number;
	}

	let { camera, containerWidth, containerHeight }: Props = $props();
</script>

<defs>
	<pattern id="canvas-dot-pattern" width="20" height="20" patternUnits="userSpaceOnUse">
		<circle class="canvas-dot" cx="1" cy="1" r="1" />
	</pattern>
</defs>

<rect
	x={camera.x}
	y={camera.y}
	width={containerWidth / camera.zoom}
	height={containerHeight / camera.zoom}
	fill="url(#canvas-dot-pattern)"
/>

<style>
	.canvas-dot {
		fill: var(--muted-foreground);
		fill-opacity: 0.3;
	}

	:global(.dark) .canvas-dot {
		fill-opacity: 0.25;
	}
</style>
