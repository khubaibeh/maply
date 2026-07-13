<script lang="ts">
	import CircleShape from "@components/canvas/shapes/CircleShape.svelte";
	import ImageShape from "@components/canvas/shapes/ImageShape.svelte";
	import PathShape from "@components/canvas/shapes/PathShape.svelte";
	import RectShape from "@components/canvas/shapes/RectShape.svelte";
	import TextShape from "@components/canvas/shapes/TextShape.svelte";
	import { Editor } from "editor";

	let { onElementPointerDown }: { onElementPointerDown: (event: PointerEvent, id: string) => void } = $props();

	const imageAssets = Editor.state.imageAssets;
	const project = Editor.state.project;
	const tool = Editor.state.tool;

	function hover(id: string) {
		if ($tool.activeTool === "select" && !$tool.isCanvasResizing) Editor.selection.setHover(id);
	}

	function clearHover(id: string) {
		if ($project.hoveredElementId === id) Editor.selection.setHover(null);
	}
</script>

<g class="canvas-elements">
	{#each $project.elements as element (element.id)}
		<g
			id="element-{element.id}"
			data-canvas-element={element.id}
			role="button"
			tabindex="-1"
			aria-label="Select {element.name}"
			class="canvas-element outline-none"
			onpointerdown={(event) => onElementPointerDown(event, element.id)}
			onpointerenter={() => hover(element.id)}
			onpointerleave={() => clearHover(element.id)}
		>
			{#if element.type === "rect"}
				<RectShape {element} />
			{:else if element.type === "circle"}
				<CircleShape {element} />
			{:else if element.type === "path"}
				{@const transform = Editor.geometry.pathRenderTransform(element)}
				<PathShape {element} x={transform.x} y={transform.y} />
			{:else if element.type === "text"}
				<TextShape
					{element}
					lines={Editor.text.wrappedLines(element)}
					lineHeight={Editor.text.wrappedLineHeight(element)}
					metrics={Editor.text.wrappedMetrics(element)}
				/>
			{:else if element.type === "image"}
				{@const asset = element.assetId ? $imageAssets[element.assetId] : null}
				{@const href = asset?.dataUrl ?? element.href ?? ""}
				{@const renderRect = asset ? Editor.geometry.imageRenderRect(element, asset) : null}
				<ImageShape {element} {href} {renderRect} />
			{/if}
		</g>
	{/each}
</g>
