<script lang="ts">
	import type { MarqueeBounds } from "@components/canvas/interaction/marquee";
	import { Editor } from "editor";

	let { box }: { box: MarqueeBounds | null } = $props();

	const canvas = Editor.state.canvas;
	const strokeWidth = $derived(1 / $canvas.camera.zoom);
	const dash = $derived(`${4 / $canvas.camera.zoom} ${3 / $canvas.camera.zoom}`);
</script>

{#if box}
	<rect
		x={box.x}
		y={box.y}
		width={box.width}
		height={box.height}
		fill="var(--canvas-selection)"
		fill-opacity="0.12"
		stroke="var(--canvas-selection)"
		stroke-width={strokeWidth}
		stroke-dasharray={dash}
		pointer-events="none"
	/>
{/if}
