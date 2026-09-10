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
	const interaction = Editor.state.interaction;
	const documentRevision = Editor.state.documentRevision;
	const tool = Editor.state.tool;
	const elementMove = createElementMove();
	let {
		viewport,
		renderElements = true,
		renderSurface = true
	}: {
		viewport: { x: number; y: number; width: number; height: number };
		renderElements?: boolean;
		renderSurface?: boolean;
	} = $props();

	const elements = $derived.by(() => {
		const revision = $documentRevision;
		if (revision < 0) return [];
		const ids = Editor.document.query(viewport, $interaction.selectedElementIds);
		return ids.flatMap((id) => {
			const element = Editor.document.get(id);
			return element && element.visible !== false ? [element] : [];
		});
	});

	const selectedElements = $derived.by(() => {
		const revision = $documentRevision;
		if (revision < 0) return [];
		return $interaction.selectedElementIds.flatMap((id) => {
			const element = Editor.document.get(id);
			return element && element.visible !== false ? [element] : [];
		});
	});
	const selectedElement = $derived(selectedElements.length === 1 ? (selectedElements[0] ?? null) : null);
	const hoveredElement = $derived.by(() => {
		const revision = $documentRevision;
		if (revision < 0) return null;
		if (
			$tool.activeTool !== "select" ||
			!$interaction.hoveredElementId ||
			$interaction.selectedElementIds.includes($interaction.hoveredElementId)
		)
			return null;
		const element = Editor.document.get($interaction.hoveredElementId);
		return element && element.visible !== false && canSelectOnCanvas(element) ? element : null;
	});
</script>

<defs>
	<filter id="canvas-shadow" x="-10%" y="-10%" width="120%" height="120%">
		<feDropShadow dx="0" dy="1" stdDeviation="3" flood-color="black" flood-opacity="0.08" />
	</filter>
</defs>

{#if renderSurface}
	<rect
		x={$canvas.x}
		y={$canvas.y}
		width={$canvas.width}
		height={$canvas.height}
		fill={$canvas.color}
		stroke="var(--border)"
		filter="url(#canvas-shadow)"
	/>
{/if}

<CanvasResizeHandles />

<g style:cursor={elementMove.state.isDragging ? canvasCursor.allScroll : undefined}>
	{#if renderElements}
		<ElementShapes {elements} onElementPointerDown={elementMove.start} />
	{/if}

	{#if selectedElements.length > 1}
		<MultiSelectionOutline elements={selectedElements} />
	{/if}

	{#if hoveredElement && hoveredElement.type !== "path"}
		<ElementOutline element={hoveredElement} interactive={false} />
	{/if}

	{#if hoveredElement?.type === "path"}
		<PathElementOutline element={hoveredElement} />
	{/if}

	{#if selectedElement}
		{#if selectedElement.type !== "path"}
			<ElementOutline element={selectedElement} onMoveStart={elementMove.start} />
		{:else}
			<PathElementOutline element={selectedElement} />
		{/if}
	{/if}
</g>

{#if selectedElement?.type === "image"}
	<ImageCropOverlay
		element={selectedElement}
		cropEditing={$interaction.cropEditingElementId === selectedElement.id}
	/>
{/if}

{#if selectedElement?.type === "path" && $tool.activeTool === "select"}
	<PathElementHandles element={selectedElement} />
{/if}
