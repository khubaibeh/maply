<script lang="ts">
	import { createPointerDrag } from "@components/canvas/interaction/pointer-drag.svelte";
	import { clientToSvgPoint, getSvgRoot } from "@components/canvas/interaction/svg";
	import { resizeCursor } from "@components/core/cursors";
	import type { Canvas } from "@maply/model/types";
	import { Editor } from "editor";
	import type { ResizeHandle } from "editor/types";

	const HANDLE_SIZE_SCREEN = 12;
	const HANDLE_LENGTH_SCREEN = 26;
	const HANDLE_THICKNESS_SCREEN = 6;
	const HIT_SIZE_SCREEN = 24;
	const HANDLE_OFFSET_SCREEN = 8;
	const STROKE_WIDTH_SCREEN = 2;

	const canvas = Editor.state.canvas;
	const project = Editor.state.project;
	const tool = Editor.state.tool;

	const canResize = $derived($tool.activeTool === "select" && $project.cropEditingElementId === null);
	const handleSize = $derived(HANDLE_SIZE_SCREEN / $canvas.camera.zoom);
	const handleLength = $derived(HANDLE_LENGTH_SCREEN / $canvas.camera.zoom);
	const handleThickness = $derived(HANDLE_THICKNESS_SCREEN / $canvas.camera.zoom);
	const hitSize = $derived(HIT_SIZE_SCREEN / $canvas.camera.zoom);
	const offset = $derived(HANDLE_OFFSET_SCREEN / $canvas.camera.zoom);
	const strokeWidth = $derived(STROKE_WIDTH_SCREEN / $canvas.camera.zoom);

	const handles = $derived([
		{
			key: "nw" as const,
			x: $canvas.x - offset,
			y: $canvas.y - offset,
			width: handleSize,
			height: handleSize,
			radius: handleThickness / 2,
			label: "Resize canvas from top left"
		},
		{
			key: "n" as const,
			x: $canvas.x + $canvas.width / 2,
			y: $canvas.y - offset,
			width: handleLength,
			height: handleThickness,
			radius: handleThickness / 2,
			label: "Resize canvas height from top"
		},
		{
			key: "ne" as const,
			x: $canvas.x + $canvas.width + offset,
			y: $canvas.y - offset,
			width: handleSize,
			height: handleSize,
			radius: handleThickness / 2,
			label: "Resize canvas from top right"
		},
		{
			key: "e" as const,
			x: $canvas.x + $canvas.width + offset,
			y: $canvas.y + $canvas.height / 2,
			width: handleThickness,
			height: handleLength,
			radius: handleThickness / 2,
			label: "Resize canvas width"
		},
		{
			key: "se" as const,
			x: $canvas.x + $canvas.width + offset,
			y: $canvas.y + $canvas.height + offset,
			width: handleSize,
			height: handleSize,
			radius: handleThickness / 2,
			label: "Resize canvas"
		},
		{
			key: "s" as const,
			x: $canvas.x + $canvas.width / 2,
			y: $canvas.y + $canvas.height + offset,
			width: handleLength,
			height: handleThickness,
			radius: handleThickness / 2,
			label: "Resize canvas height"
		},
		{
			key: "sw" as const,
			x: $canvas.x - offset,
			y: $canvas.y + $canvas.height + offset,
			width: handleSize,
			height: handleSize,
			radius: handleThickness / 2,
			label: "Resize canvas from bottom left"
		},
		{
			key: "w" as const,
			x: $canvas.x - offset,
			y: $canvas.y + $canvas.height / 2,
			width: handleThickness,
			height: handleLength,
			radius: handleThickness / 2,
			label: "Resize canvas width from left"
		}
	]);
	const drag = createPointerDrag();

	function startResize(event: PointerEvent, handle: ResizeHandle) {
		if (event.button !== 0) return;
		if (!canResize) return;

		event.preventDefault();
		event.stopPropagation();

		const svg = getSvgRoot(event.target);
		if (!svg) return;
		drag.start(event, {
			project: (pointerEvent) => clientToSvgPoint(svg, pointerEvent.clientX, pointerEvent.clientY),
			onMove: ({ delta }) => {
				const left = $canvas.x;
				const top = $canvas.y;
				const right = $canvas.x + $canvas.width;
				const bottom = $canvas.y + $canvas.height;

				let nextLeft = handle.includes("w") ? left + delta.x : left;
				let nextTop = handle.includes("n") ? top + delta.y : top;
				let nextRight = handle.includes("e") ? right + delta.x : right;
				let nextBottom = handle.includes("s") ? bottom + delta.y : bottom;

				const nextWidth = Math.max(1, Math.round(nextRight - nextLeft));
				const nextHeight = Math.max(1, Math.round(nextBottom - nextTop));

				if (handle.includes("w")) {
					nextLeft = nextRight - nextWidth;
				} else {
					nextRight = nextLeft + nextWidth;
				}

				if (handle.includes("n")) {
					nextTop = nextBottom - nextHeight;
				} else {
					nextBottom = nextTop + nextHeight;
				}

				const nextCanvas: Canvas = {
					x: nextLeft,
					y: nextTop,
					width: nextRight - nextLeft,
					height: nextBottom - nextTop,
					color: $canvas.color
				};
				Editor.actions.canvas.setFrame(nextCanvas.x, nextCanvas.y, nextCanvas.width, nextCanvas.height);
				Editor.element.clampAll();
			}
		});
	}
</script>

{#if canResize}
	<g aria-label="Resize canvas">
		{#each handles as handle (handle.key)}
			<rect
				x={handle.x - Math.max(hitSize, handle.width) / 2}
				y={handle.y - Math.max(hitSize, handle.height) / 2}
				role="button"
				tabindex="-1"
				aria-label={handle.label}
				width={Math.max(hitSize, handle.width)}
				height={Math.max(hitSize, handle.height)}
				fill="transparent"
				style:cursor={resizeCursor(handle.key)}
				onpointerdown={(event) => startResize(event, handle.key)}
			/>
			<rect
				x={handle.x - handle.width / 2}
				y={handle.y - handle.height / 2}
				width={handle.width}
				height={handle.height}
				rx={handle.radius}
				fill="transparent"
				stroke="transparent"
				stroke-width={strokeWidth}
				pointer-events="none"
			/>
		{/each}
	</g>
{/if}
