<script lang="ts">
	import { App } from "@app";

	import CanvasResizeHandles from "./CanvasResizeHandles.svelte";
	import ElementOutline from "./ElementOutline.svelte";
	import ElementShapes from "./ElementShapes.svelte";
	import ImageCropOverlay from "./ImageCropOverlay.svelte";
	import PathElementHandles from "./PathElementHandles.svelte";
	import PathElementOutline from "./PathElementOutline.svelte";

	const canvas = App.state.canvas;
	const project = App.state.project;
	const tool = App.state.tool;

	const selectedElements = $derived(
		$project.elements.filter((element) => $project.selectedElementIds.includes(element.id))
	);
	const selectedElement = $derived(selectedElements.length === 1 ? (selectedElements[0] ?? null) : null);
	const hoveredElement = $derived(
		$tool.activeTool === "select" &&
			$project.hoveredElementId &&
			!$project.selectedElementIds.includes($project.hoveredElementId)
			? ($project.elements.find((element) => element.id === $project.hoveredElementId) ?? null)
			: null
	);
</script>

<defs>
	<filter id="canvas-shadow" x="-10%" y="-10%" width="120%" height="120%">
		<feDropShadow dx="0" dy="1" stdDeviation="3" flood-color="black" flood-opacity="0.08" />
	</filter>
</defs>

<rect
	x={$canvas.x}
	y={$canvas.y}
	width={$canvas.width}
	height={$canvas.height}
	fill={$canvas.color}
	stroke="var(--border)"
	filter="url(#canvas-shadow)"
/>

<CanvasResizeHandles />

<ElementShapes />

{#if hoveredElement && hoveredElement.type !== "path"}
	<ElementOutline element={hoveredElement} interactive={false} />
{/if}

{#if hoveredElement?.type === "path"}
	<PathElementOutline element={hoveredElement} />
{/if}

{#each selectedElements as element (element.id)}
	{#if element.type !== "path"}
		<ElementOutline {element} />
	{:else}
		<PathElementOutline {element} />
	{/if}
{/each}

{#if selectedElement?.type === "image"}
	<ImageCropOverlay element={selectedElement} cropEditing={$project.cropEditingElementId === selectedElement.id} />
{/if}

{#if selectedElement?.type === "path" && $tool.activeTool === "select"}
	<PathElementHandles element={selectedElement} />
{/if}
