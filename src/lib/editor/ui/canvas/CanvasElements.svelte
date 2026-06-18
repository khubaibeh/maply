<script lang="ts">
	import { projectState } from "$lib/editor/state/project.svelte";
	import { toolState } from "$lib/editor/state/tool.svelte";

	function selectElement(event: PointerEvent, id: string) {
		if ($toolState.activeTool !== "select") return;
		event.stopPropagation();
		projectState.selectElement(id);
	}
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
			<path
				id="element-{element.id}"
				role="button"
				tabindex="-1"
				aria-label="Select {element.name}"
				transform="translate({element.x}, {element.y})"
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
