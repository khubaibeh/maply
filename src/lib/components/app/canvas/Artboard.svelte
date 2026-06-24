<script lang="ts">
	import { canvasState } from "$lib/app/state/canvas.svelte";
	import { projectState } from "$lib/app/state/project.svelte";
	import { toolState } from "$lib/app/state/tool.svelte";

	import Elements from "./Elements.svelte";
	import ImageCropOverlay from "./ImageCropOverlay.svelte";
	import Outline from "./Outline.svelte";
	import PathHandles from "./PathHandles.svelte";

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

{#if selectedElement && selectedElement.type !== "path"}
	<Outline element={selectedElement} />
{/if}

{#if selectedElement?.type === "image"}
	<ImageCropOverlay
		element={selectedElement}
		cropEditing={$projectState.cropEditingElementId === selectedElement.id}
	/>
{/if}

{#if selectedElement?.type === "path" && $toolState.activeTool === "select"}
	<PathHandles element={selectedElement} />
{/if}
