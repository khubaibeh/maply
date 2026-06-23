<script lang="ts">
	import type { Element } from "$lib/app/domain/elements";
	import { projectState } from "$lib/app/state/project.svelte";
	import { toolState } from "$lib/app/state/tool.svelte";
	import { onMount } from "svelte";

	interface Props {
		element: Element;
	}

	let { element }: Props = $props();

	let bbox = $state({ x: 0, y: 0, width: 0, height: 0 });
	let dragState = $state<{
		elementX: number;
		elementY: number;
		grabX: number;
		grabY: number;
	} | null>(null);

	$effect(() => {
		if (typeof document === "undefined") return;
		const el = document.getElementById(`element-${element.id}`);
		if (!(el instanceof SVGGraphicsElement)) return;
		const svg = el.ownerSVGElement;
		if (!svg) return;
		const elementScreenMatrix = el.getScreenCTM();
		const svgScreenMatrix = svg.getScreenCTM();
		if (!elementScreenMatrix || !svgScreenMatrix) return;

		const rect = el.getBBox();
		// Project the element's local bbox through SVG matrices so transformed paths outline correctly.
		const matrix = svgScreenMatrix.inverse().multiply(elementScreenMatrix);
		const corners = [
			toSvgPoint(svg, rect.x, rect.y).matrixTransform(matrix),
			toSvgPoint(svg, rect.x + rect.width, rect.y).matrixTransform(matrix),
			toSvgPoint(svg, rect.x, rect.y + rect.height).matrixTransform(matrix),
			toSvgPoint(svg, rect.x + rect.width, rect.y + rect.height).matrixTransform(matrix)
		];
		const minX = Math.min(...corners.map((point) => point.x));
		const minY = Math.min(...corners.map((point) => point.y));
		const maxX = Math.max(...corners.map((point) => point.x));
		const maxY = Math.max(...corners.map((point) => point.y));
		const padding = 2;

		bbox = {
			x: minX - padding,
			y: minY - padding,
			width: maxX - minX + padding * 2,
			height: maxY - minY + padding * 2
		};
	});

	function toSvgPoint(svg: SVGSVGElement, x: number, y: number) {
		const point = svg.createSVGPoint();
		point.x = x;
		point.y = y;
		return point;
	}

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

	function getElementOrigin() {
		if (element.type === "circle") return { x: element.cx, y: element.cy };
		return { x: element.x, y: element.y };
	}

	function startSelectionDrag(event: PointerEvent) {
		if (event.button !== 0) return;
		if ($toolState.activeTool !== "select") return;

		event.stopPropagation();
		projectState.selectElement(element.id);

		const svg = getSvgRoot(event.target);
		if (!svg) return;

		const svgPoint = clientToSvgPoint(svg, event.clientX, event.clientY);
		if (!svgPoint) return;

		const origin = getElementOrigin();
		dragState = {
			elementX: origin.x,
			elementY: origin.y,
			grabX: svgPoint.x,
			grabY: svgPoint.y
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
			projectState.setElementPosition(element.id, nextX, nextY);
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

<rect
	role="button"
	data-canvas-element={element.id}
	tabindex="-1"
	aria-label="Move {element.name}"
	x={bbox.x}
	y={bbox.y}
	width={bbox.width}
	height={bbox.height}
	fill="transparent"
	stroke="var(--primary)"
	stroke-width="1"
	pointer-events="all"
	class="cursor-inherit"
	onpointerdown={startSelectionDrag}
/>
