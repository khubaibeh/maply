<script lang="ts">
	import { createElementMove } from "@components/canvas/interaction/element-move.svelte";
	import { canSelectOnCanvas } from "@components/canvas/interaction/element-selection";
	import { canvasCursor } from "@components/core/cursors";
	import { Editor } from "editor";

	import CanvasResizeHandles from "./CanvasResizeHandles.svelte";
	import ElementOutline from "./ElementOutline.svelte";
	import ElementShapes from "./ElementShapes.svelte";
	import ImageCropOverlay from "./ImageCropOverlay.svelte";
	import MultiSelectionOutline from "./MultiSelectionOutline.svelte";
	import PathElementHandles from "./PathElementHandles.svelte";
	import PathElementOutline from "./PathElementOutline.svelte";

	const canvas = Editor.state.canvas;
	const project = Editor.state.project;
	const tool = Editor.state.tool;
	const elementMove = createElementMove();

	const selectedElements = $derived(
		$project.elements.filter(
			(element) => element.visible !== false && $project.selectedElementIds.includes(element.id)
		)
	);
	const selectedElement = $derived(selectedElements.length === 1 ? (selectedElements[0] ?? null) : null);
	const hoveredElement = $derived(
		$tool.activeTool === "select" &&
			$project.hoveredElementId &&
			!$project.selectedElementIds.includes($project.hoveredElementId)
			? ($project.elements.find(
					(element) =>
						element.id === $project.hoveredElementId &&
						element.visible !== false &&
						canSelectOnCanvas(element)
				) ?? null)
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

{#if selectedElements.length > 1}
	<MultiSelectionOutline elements={selectedElements} />
{/if}

<CanvasResizeHandles />

<g style:cursor={elementMove.state.isDragging ? canvasCursor.allScroll : undefined}>
	<ElementShapes onElementPointerDown={elementMove.start} />

	{#if hoveredElement && hoveredElement.type !== "path"}
		<ElementOutline element={hoveredElement} interactive={false} />
	{/if}

	{#if hoveredElement?.type === "path"}
		<PathElementOutline element={hoveredElement} />
	{/if}

	{#each selectedElements as element (element.id)}
		{#if element.type !== "path"}
			<ElementOutline {element} onMoveStart={elementMove.start} />
		{:else}
			<PathElementOutline {element} />
		{/if}
	{/each}
</g>

{#if selectedElement?.type === "image"}
	<ImageCropOverlay element={selectedElement} cropEditing={$project.cropEditingElementId === selectedElement.id} />
{/if}

{#if selectedElement?.type === "path" && $tool.activeTool === "select"}
	<PathElementHandles element={selectedElement} />
{/if}
