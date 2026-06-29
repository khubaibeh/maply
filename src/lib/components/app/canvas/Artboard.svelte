<script lang="ts">
	import { App } from "@app";

	import Elements from "./Elements.svelte";
	import ImageCropOverlay from "./ImageCropOverlay.svelte";
	import Outline from "./Outline.svelte";
	import PathHandles from "./PathHandles.svelte";
	import PathOutline from "./PathOutline.svelte";

	const canvas = App.state.canvas;
	const project = App.state.project;
	const tool = App.state.tool;

	const selectedElement = $derived(
		$project.elements.find((element) => element.id === $project.selectedElementId) ?? null
	);
	const hoveredElement = $derived(
		$tool.activeTool === "select" &&
			$project.hoveredElementId &&
			$project.hoveredElementId !== $project.selectedElementId
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

<Elements />

{#if hoveredElement && hoveredElement.type !== "path"}
	<Outline element={hoveredElement} interactive={false} />
{/if}

{#if hoveredElement?.type === "path"}
	<PathOutline element={hoveredElement} />
{/if}

{#if selectedElement && selectedElement.type !== "path"}
	<Outline element={selectedElement} />
{/if}

{#if selectedElement?.type === "path"}
	<PathOutline element={selectedElement} />
{/if}

{#if selectedElement?.type === "image"}
	<ImageCropOverlay element={selectedElement} cropEditing={$project.cropEditingElementId === selectedElement.id} />
{/if}

{#if selectedElement?.type === "path" && $tool.activeTool === "select"}
	<PathHandles element={selectedElement} />
{/if}
