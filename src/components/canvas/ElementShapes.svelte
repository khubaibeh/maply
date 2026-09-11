<script lang="ts">
	import { insertPathVertexAtPointer } from "@components/canvas/interaction/path-vertex";
	import { getSvgRoot } from "@components/canvas/interaction/svg";
	import CircleShape from "@components/canvas/shapes/CircleShape.svelte";
	import ImageShape from "@components/canvas/shapes/ImageShape.svelte";
	import PathShape from "@components/canvas/shapes/PathShape.svelte";
	import RectShape from "@components/canvas/shapes/RectShape.svelte";
	import TextShape from "@components/canvas/shapes/TextShape.svelte";
	import type { Element, PathElement } from "@maply/model/types";
	import { Editor } from "editor";

	let {
		elements,
		onElementPointerDown
	}: {
		elements: readonly Element[];
		onElementPointerDown: (event: PointerEvent, id: string) => void;
	} = $props();

	const imageAssets = Editor.state.imageAssets;
	const canvas = Editor.state.canvas;
	const tool = Editor.state.tool;

	function insertPathVertex(event: MouseEvent, element: PathElement) {
		if ($tool.activeTool !== "select" || element.locked) return;
		insertPathVertexAtPointer(event, element, getSvgRoot(event.target), $canvas.camera.zoom);
	}
</script>

<g class="canvas-elements" data-rendered-elements={elements.length}>
	{#each elements as element (element.id)}
		{#if element.visible !== false}
			<g
				id="element-{element.id}"
				data-canvas-element={element.id}
				role="button"
				tabindex="-1"
				aria-label="Select {element.name}"
				class="canvas-element outline-none"
				onpointerdown={(event) => onElementPointerDown(event, element.id)}
				ondblclick={element.type === "path" ? (event) => insertPathVertex(event, element) : undefined}
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
		{/if}
	{/each}
</g>
