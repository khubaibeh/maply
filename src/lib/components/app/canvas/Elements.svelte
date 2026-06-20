<script lang="ts">
	import { getPathRenderTransform } from "$lib/app/core/element-actions";
	import { canvasState } from "$lib/app/state/canvas.svelte";
	import { projectState } from "$lib/app/state/project.svelte";
	import { toolState } from "$lib/app/state/tool.svelte";
	import { onMount } from "svelte";

	let dragState = $state<{ id: string; clientX: number; clientY: number } | null>(null);

	function selectElement(event: PointerEvent, id: string) {
		if ($toolState.activeTool !== "select") return;
		event.stopPropagation();
		projectState.selectElement(id);
		dragState = { id, clientX: event.clientX, clientY: event.clientY };
	}

	onMount(() => {
		function handlePointerMove(event: PointerEvent) {
			if (!dragState) return;

			const dx = (event.clientX - dragState.clientX) / $canvasState.camera.zoom;
			const dy = (event.clientY - dragState.clientY) / $canvasState.camera.zoom;
			dragState = { id: dragState.id, clientX: event.clientX, clientY: event.clientY };
			projectState.translateElement(dragState.id, dx, dy);
		}

		function stopDragging() {
			dragState = null;
		}

		window.addEventListener("pointermove", handlePointerMove);
		window.addEventListener("pointerup", stopDragging);
		window.addEventListener("pointercancel", stopDragging);

		return () => {
			window.removeEventListener("pointermove", handlePointerMove);
			window.removeEventListener("pointerup", stopDragging);
			window.removeEventListener("pointercancel", stopDragging);
		};
	});
</script>

<g class="canvas-elements">
	{#each $projectState.elements as element (element.id)}
		{#if element.type === "rect"}
			<rect
				id="element-{element.id}"
				role="button"
				tabindex="-1"
				aria-label="Select {element.name}"
				x={element.x}
				y={element.y}
				width={element.width}
				height={element.height}
				fill={element.fill}
				stroke={element.stroke}
				stroke-width={element.strokeWidth}
				class="canvas-element outline-none"
				onpointerdown={(event) => selectElement(event, element.id)}
			/>
		{:else if element.type === "circle"}
			<circle
				id="element-{element.id}"
				role="button"
				tabindex="-1"
				aria-label="Select {element.name}"
				cx={element.cx}
				cy={element.cy}
				r={element.r}
				fill={element.fill}
				stroke={element.stroke}
				stroke-width={element.strokeWidth}
				class="canvas-element outline-none"
				onpointerdown={(event) => selectElement(event, element.id)}
			/>
		{:else if element.type === "path"}
			{@const transform = getPathRenderTransform(element)}
			<path
				id="element-{element.id}"
				role="button"
				tabindex="-1"
				aria-label="Select {element.name}"
				transform="translate({transform.x}, {transform.y})"
				d={element.d}
				fill={element.fill}
				stroke={element.stroke}
				stroke-width={element.strokeWidth}
				class="canvas-element outline-none"
				onpointerdown={(event) => selectElement(event, element.id)}
			/>
		{:else if element.type === "text"}
			<text
				id="element-{element.id}"
				role="button"
				tabindex="-1"
				aria-label="Select {element.name}"
				x={element.x}
				y={element.y}
				font-size={element.fontSize}
				fill={element.fill}
				class="canvas-element outline-none select-none"
				onpointerdown={(event) => selectElement(event, element.id)}
			>
				{element.text}
			</text>
		{:else if element.type === "image"}
			<image
				id="element-{element.id}"
				role="button"
				tabindex="-1"
				aria-label="Select {element.name}"
				x={element.x}
				y={element.y}
				width={element.width}
				height={element.height}
				href={element.href}
				class="canvas-element outline-none"
				onpointerdown={(event) => selectElement(event, element.id)}
			/>
		{/if}
	{/each}
</g>
