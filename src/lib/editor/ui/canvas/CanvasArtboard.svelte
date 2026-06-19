<script lang="ts">
	import { canvasState } from "$lib/editor/state/canvas.svelte";
	import { projectState } from "$lib/editor/state/project.svelte";

	import CanvasElements from "./CanvasElements.svelte";
	import SelectionOutline from "./SelectionOutline.svelte";

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
	fill="#ffffff"
	stroke="var(--border)"
	filter="url(#canvas-shadow)"
/>

<CanvasElements />

{#if selectedElement}
	<SelectionOutline element={selectedElement} />
{/if}
