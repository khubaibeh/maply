<script lang="ts">
	import { canvasState } from "$lib/app/state/canvas.svelte";
	import { projectState } from "$lib/app/state/project.svelte";

	import Elements from "./Elements.svelte";
	import Outline from "./Outline.svelte";

	const selectedElement = $derived(
		$projectState.elements.find((element) => element.id === $projectState.selectedElementId) ?? null
	);
</script>

<defs>
	<filter id="canvas-shadow" x="-10%" y="-10%" width="120%" height="120%">
		<feDropShadow dx="0" dy="1" stdDeviation="3" flood-color="black" flood-opacity="0.08" />
	</filter>
</defs>

<rect
	x={$canvasState.x}
	y={$canvasState.y}
	width={$canvasState.width}
	height={$canvasState.height}
	fill={$canvasState.color}
	stroke="var(--border)"
	filter="url(#canvas-shadow)"
/>

<Elements />

{#if selectedElement}
	<Outline element={selectedElement} />
{/if}
