<script lang="ts">
	import type { Element } from "@maply/model/types";
	import { Editor } from "editor";

	let { elements }: { elements: readonly Element[] } = $props();

	const canvas = Editor.state.canvas;
	const strokeWidth = $derived(1.5 / $canvas.camera.zoom);
	const dash = $derived(`${3 / $canvas.camera.zoom} ${2 / $canvas.camera.zoom}`);
</script>

{#each elements as element (element.id)}
	{@const bounds = Editor.geometry.elementBounds(element)}
	<rect
		x={bounds.x}
		y={bounds.y}
		width={bounds.width}
		height={bounds.height}
		fill="var(--canvas-selection)"
		fill-opacity="0.08"
		stroke="var(--canvas-selection)"
		stroke-width={strokeWidth}
		stroke-dasharray={dash}
		pointer-events="none"
	/>
{/each}
