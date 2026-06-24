<script lang="ts">
	import { getPathRenderTransform } from "$lib/app/core/element-actions";
	import { projectState } from "$lib/app/state/project.svelte";
	import { toolState } from "$lib/app/state/tool.svelte";
	import { onMount } from "svelte";

	let dragState = $state<{
		id: string;
		elementX: number;
		elementY: number;
		grabX: number;
		grabY: number;
		wasSelected: boolean;
		didMove: boolean;
	} | null>(null);

	function getSvgRoot(target: EventTarget | null): SVGSVGElement | null {
		if (!(target instanceof Element)) return null;
		const node = target.closest("svg");
		return node instanceof SVGSVGElement ? node : null;
	}

	function clientToSvgPoint(svg: SVGSVGElement, clientX: number, clientY: number) {
		const ctm = svg.getScreenCTM();
		if (!ctm) return null;
		const point = svg.createSVGPoint();
		point.x = clientX;
		point.y = clientY;
		return point.matrixTransform(ctm.inverse());
	}

	function getElementOrigin(element: (typeof $projectState.elements)[number]) {
		if (element.type === "circle") return { x: element.cx, y: element.cy };
		return { x: element.x, y: element.y };
	}

	function selectElement(event: PointerEvent, id: string) {
		if ($toolState.activeTool !== "select") return;
		event.stopPropagation();

		const wasSelected = $projectState.selectedElementId === id;
		if (!wasSelected) {
			projectState.selectElement(id);
		}

		const element = $projectState.elements.find((e) => e.id === id);
		if (!element) return;

		const svg = getSvgRoot(event.target);
		if (!svg) return;

		const svgPoint = clientToSvgPoint(svg, event.clientX, event.clientY);
		if (!svgPoint) return;

		const origin = getElementOrigin(element);
		dragState = {
			id,
			elementX: origin.x,
			elementY: origin.y,
			grabX: svgPoint.x,
			grabY: svgPoint.y,
			wasSelected,
			didMove: false
		};
	}

	onMount(() => {
		function handlePointerMove(event: PointerEvent) {
			if (!dragState) return;

			const svg = getSvgRoot(event.target);
			if (!svg) return;

			const svgPoint = clientToSvgPoint(svg, event.clientX, event.clientY);
			if (!svgPoint) return;

			const nextX = dragState.elementX + (svgPoint.x - dragState.grabX);
			const nextY = dragState.elementY + (svgPoint.y - dragState.grabY);
			dragState.didMove = true;
			projectState.setElementPosition(dragState.id, nextX, nextY);
		}

		function stopDragging() {
			if (dragState && dragState.wasSelected && !dragState.didMove) {
				projectState.selectElement(null);
			}
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
				data-canvas-element={element.id}
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
				data-canvas-element={element.id}
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
				data-canvas-element={element.id}
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
				data-canvas-element={element.id}
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
				data-canvas-element={element.id}
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
