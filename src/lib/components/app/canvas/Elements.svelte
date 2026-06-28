<script lang="ts">
	import {
		getPathRenderTransform,
		getWrappedTextLineHeight,
		getWrappedTextLines,
		getWrappedTextMetrics
	} from "$lib/app/core/element-actions";
	import { getImageRenderRect } from "$lib/app/core/image-assets";
	import { App } from "@app";
	import { onMount } from "svelte";

	const imageAssets = App.state.imageAssets;
	const project = App.state.project;
	const tool = App.state.tool;

	let dragState = $state<{
		kind: "move";
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

	function getElementOrigin(element: (typeof $project.elements)[number]) {
		if (element.type === "circle") return { x: element.cx, y: element.cy };
		return { x: element.x, y: element.y };
	}

	function selectElement(event: PointerEvent, id: string) {
		if ($tool.activeTool !== "select") return;
		event.stopPropagation();

		const wasSelected = $project.selectedElementId === id;
		if (!wasSelected) {
			App.actions.project.selectElement(id);
		}

		const element = $project.elements.find((e) => e.id === id);
		if (!element) return;

		const svg = getSvgRoot(event.target);
		if (!svg) return;

		const svgPoint = clientToSvgPoint(svg, event.clientX, event.clientY);
		if (!svgPoint) return;

		const origin = getElementOrigin(element);
		dragState = {
			kind: "move",
			id,
			elementX: origin.x,
			elementY: origin.y,
			grabX: svgPoint.x,
			grabY: svgPoint.y,
			wasSelected,
			didMove: false
		};
	}

	function hoverElement(id: string) {
		if ($tool.activeTool !== "select") return;
		App.actions.project.setHoveredElement(id);
	}

	function clearHoveredElement(id: string) {
		if ($project.hoveredElementId !== id) return;
		App.actions.project.setHoveredElement(null);
	}

	onMount(() => {
		function handlePointerMove(event: PointerEvent) {
			if (!dragState) return;

			const svg = getSvgRoot(event.target);
			if (!svg) return;

			const svgPoint = clientToSvgPoint(svg, event.clientX, event.clientY);
			if (!svgPoint) return;

			dragState.didMove = true;
			const nextX = dragState.elementX + (svgPoint.x - dragState.grabX);
			const nextY = dragState.elementY + (svgPoint.y - dragState.grabY);
			App.actions.project.setElementPosition(dragState.id, nextX, nextY);
		}

		function stopDragging() {
			if (dragState && dragState.wasSelected && !dragState.didMove) {
				App.actions.project.selectElement(null);
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
	{#each $project.elements as element (element.id)}
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
				onpointerenter={() => hoverElement(element.id)}
				onpointerleave={() => clearHoveredElement(element.id)}
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
				onpointerenter={() => hoverElement(element.id)}
				onpointerleave={() => clearHoveredElement(element.id)}
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
				onpointerenter={() => hoverElement(element.id)}
				onpointerleave={() => clearHoveredElement(element.id)}
			/>
		{:else if element.type === "text"}
			{@const wrappedLines = getWrappedTextLines(element)}
			{@const lineHeight = getWrappedTextLineHeight(element)}
			{@const textMetrics = getWrappedTextMetrics(element)}
			<defs>
				<clipPath id="text-clip-{element.id}">
					<rect
						x={element.x - textMetrics.left}
						y={element.y - textMetrics.ascent}
						width={element.width}
						height={element.height}
					/>
				</clipPath>
			</defs>
			<text
				id="element-{element.id}"
				data-canvas-element={element.id}
				role="button"
				tabindex="-1"
				aria-label="Select {element.name}"
				x={element.x}
				y={element.y}
				font-size={element.fontSize}
				font-family="Inter Variable, sans-serif"
				fill={element.fill}
				xml:space="preserve"
				clip-path="url(#text-clip-{element.id})"
				class="canvas-element outline-none select-none"
				onpointerdown={(event) => selectElement(event, element.id)}
				onpointerenter={() => hoverElement(element.id)}
				onpointerleave={() => clearHoveredElement(element.id)}
			>
				{#each wrappedLines as line, index (index)}
					<tspan x={element.x} dy={index === 0 ? 0 : `${lineHeight}px`}>
						{line || " "}
					</tspan>
				{/each}
			</text>
		{:else if element.type === "image"}
			{@const imageAsset = element.assetId ? $imageAssets[element.assetId] : null}
			{@const imageHref = imageAsset?.dataUrl ?? element.href ?? ""}
			<g
				id="element-{element.id}"
				data-canvas-element={element.id}
				role="button"
				tabindex="-1"
				aria-label="Select {element.name}"
				class="canvas-element outline-none"
				onpointerdown={(event) => selectElement(event, element.id)}
				onpointerenter={() => hoverElement(element.id)}
				onpointerleave={() => clearHoveredElement(element.id)}
			>
				<rect x={element.x} y={element.y} width={element.width} height={element.height} fill="var(--muted)" />
				{#if imageHref}
					{@const renderRect = imageAsset
						? getImageRenderRect({
								x: 0,
								y: 0,
								width: element.width,
								height: element.height,
								assetWidth: imageAsset.width,
								assetHeight: imageAsset.height,
								cropX: element.cropX,
								cropY: element.cropY,
								cropScale: element.cropScale
							})
						: null}
					<svg
						x={element.x}
						y={element.y}
						width={element.width}
						height={element.height}
						viewBox={`0 0 ${element.width} ${element.height}`}
						overflow="hidden"
						pointer-events="none"
					>
						{#if imageAsset && renderRect}
							<image
								x={renderRect.x}
								y={renderRect.y}
								width={renderRect.width}
								height={renderRect.height}
								href={imageHref}
								preserveAspectRatio="none"
							/>
						{:else}
							<image
								x="0"
								y="0"
								width={element.width}
								height={element.height}
								href={imageHref}
								preserveAspectRatio="xMidYMid slice"
							/>
						{/if}
					</svg>
				{:else}
					<path
						d="M0 0h18l5 6h13v18H0z"
						fill="none"
						stroke="var(--muted-foreground)"
						stroke-width="1.5"
						transform="translate({element.x + element.width / 2 - 18}, {element.y +
							element.height / 2 -
							16})"
						pointer-events="none"
					/>
					<line
						x1={element.x + 14}
						y1={element.y + element.height - 14}
						x2={element.x + element.width - 14}
						y2={element.y + 14}
						stroke="var(--muted-foreground)"
						stroke-opacity="0.35"
						stroke-width="2"
						stroke-linecap="round"
						pointer-events="none"
					/>
				{/if}
			</g>
		{/if}
	{/each}
</g>
