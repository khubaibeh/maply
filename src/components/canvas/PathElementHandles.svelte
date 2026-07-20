<script lang="ts">
	import { createPointerDrag } from "@components/canvas/interaction/pointer-drag.svelte";
	import { clientToSvgPoint, getSvgRoot } from "@components/canvas/interaction/svg";
	import { canvasCursor } from "@components/core/cursors";
	import type { PathElement, Point } from "@maply/model/types";
	import { Editor } from "editor";

	let { element }: { element: PathElement } = $props();
	const canvas = Editor.state.canvas;

	const points = $derived(Editor.geometry.pathPoints(element.d));
	const transform = $derived(Editor.geometry.pathRenderTransform(element));
	const handleSize = $derived(8 / $canvas.camera.zoom);
	const halfHandleSize = $derived(handleSize / 2);
	const drag = createPointerDrag();

	function clampPathPoint(point: Point, offsetX: number, offsetY: number) {
		const strokePadding = Math.ceil(element.strokeWidth / 2);
		const canvasRight = $canvas.x + $canvas.width;
		const canvasBottom = $canvas.y + $canvas.height;
		return {
			x: Math.max($canvas.x - offsetX, Math.min(canvasRight - offsetX - strokePadding * 2, point.x)),
			y: Math.max($canvas.y - offsetY, Math.min(canvasBottom - offsetY - strokePadding * 2, point.y))
		};
	}

	function startHandleDrag(event: PointerEvent, index: number) {
		if (event.button !== 0) return;
		event.preventDefault();
		event.stopPropagation();
		const svg = getSvgRoot(event.target);
		if (!svg) return;
		const start = points[index];
		drag.start(event, {
			project: (pointerEvent) => clientToSvgPoint(svg, pointerEvent.clientX, pointerEvent.clientY),
			onMove: ({ totalDelta }) => {
				const oldBounds = Editor.geometry.pathBounds(points);
				const offsetX = element.x - oldBounds.x;
				const offsetY = element.y - oldBounds.y;
				const nextPoint = clampPathPoint(
					{ x: start.x + totalDelta.x, y: start.y + totalDelta.y },
					offsetX,
					offsetY
				);
				Editor.element.updatePathVertex(element.id, index, nextPoint);
			}
		});
	}
</script>

{#if points.length > 0}
	<g class="path-handles" pointer-events="all" transform="translate({transform.x}, {transform.y})">
		{#each points as point, index (index)}
			<rect
				x={point.x - halfHandleSize}
				y={point.y - halfHandleSize}
				width={handleSize}
				height={handleSize}
				fill="#eaeaea"
				stroke="var(--canvas-selection)"
				stroke-width="2"
				role="button"
				tabindex="-1"
				aria-label="Edit path vertex"
				style:cursor={canvasCursor.default}
				onpointerdown={(event) => startHandleDrag(event, index)}
			/>
		{/each}
	</g>
{/if}
