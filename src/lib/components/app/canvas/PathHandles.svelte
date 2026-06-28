<script lang="ts">
	import { getPathRenderTransform } from "$lib/app/core/element-actions";
	import { getPathDataBounds, getPathPoints, updatePathVertex } from "$lib/app/core/path-geometry";
	import type { Element, PathElement } from "$lib/app/domain/elements";
	import type { Point } from "$lib/app/domain/geometry";
	import { App } from "@app";
	import { onMount } from "svelte";

	interface Props {
		element: PathElement;
	}

	let { element }: Props = $props();
	const canvas = App.state.canvas;

	const HANDLE_SIZE_SCREEN = 8;

	let dragState = $state<{
		index: number;
		startPoint: Point;
		grabPoint: Point;
		svg: SVGSVGElement;
	} | null>(null);

	const points = $derived(getPathPoints(element.d));
	const transform = $derived(getPathRenderTransform(element));
	const handleSize = $derived(HANDLE_SIZE_SCREEN / $canvas.camera.zoom);
	const halfHandleSize = $derived(handleSize / 2);

	function getSvgRoot(target: EventTarget | null): SVGSVGElement | null {
		if (!(target instanceof Element)) return null;
		const node = target.closest("svg");
		return node instanceof SVGSVGElement ? node : null;
	}

	function clientToSvgPoint(svg: SVGSVGElement, clientX: number, clientY: number): Point | null {
		const ctm = svg.getScreenCTM();
		if (!ctm) return null;
		const point = svg.createSVGPoint();
		point.x = clientX;
		point.y = clientY;
		const svgPoint = point.matrixTransform(ctm.inverse());
		return { x: svgPoint.x, y: svgPoint.y };
	}

	function startHandleDrag(event: PointerEvent, index: number) {
		if (event.button !== 0) return;
		event.preventDefault();
		event.stopPropagation();

		const svg = getSvgRoot(event.target);
		if (!svg) return;
		const svgPoint = clientToSvgPoint(svg, event.clientX, event.clientY);
		if (!svgPoint) return;

		dragState = {
			index,
			startPoint: points[index],
			grabPoint: svgPoint,
			svg
		};
	}

	function clampPathPoint(point: Point, offsetX: number, offsetY: number) {
		const strokePadding = Math.ceil(element.strokeWidth / 2);
		const canvasRight = $canvas.x + $canvas.width;
		const canvasBottom = $canvas.y + $canvas.height;

		return {
			x: Math.max($canvas.x - offsetX, Math.min(canvasRight - offsetX - strokePadding * 2, point.x)),
			y: Math.max($canvas.y - offsetY, Math.min(canvasBottom - offsetY - strokePadding * 2, point.y))
		};
	}

	onMount(() => {
		function handlePointerMove(event: PointerEvent) {
			if (!dragState) return;

			const svgPoint = clientToSvgPoint(dragState.svg, event.clientX, event.clientY);
			if (!svgPoint) return;

			const oldBounds = getPathDataBounds(points);
			const offsetX = element.x - oldBounds.x;
			const offsetY = element.y - oldBounds.y;

			const nextPoint = clampPathPoint(
				{
					x: dragState.startPoint.x + (svgPoint.x - dragState.grabPoint.x),
					y: dragState.startPoint.y + (svgPoint.y - dragState.grabPoint.y)
				},
				offsetX,
				offsetY
			);

			const { d, bounds } = updatePathVertex(element.d, dragState.index, nextPoint);

			App.actions.project.updateElement(element.id, {
				d,
				x: Math.round(bounds.x + offsetX),
				y: Math.round(bounds.y + offsetY)
			} as Partial<Element>);
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

{#if points.length > 0}
	<g class="path-handles" pointer-events="all" transform="translate({transform.x}, {transform.y})">
		{#each points as point, index (index)}
			<rect
				x={point.x - halfHandleSize}
				y={point.y - halfHandleSize}
				width={handleSize}
				height={handleSize}
				fill="var(--background)"
				stroke="var(--primary)"
				stroke-width="1"
				role="button"
				tabindex="-1"
				aria-label="Edit path vertex"
				class="cursor-pointer"
				onpointerdown={(event) => startHandleDrag(event, index)}
			/>
		{/each}
	</g>
{/if}
