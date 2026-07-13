<script lang="ts">
	import { resizeAnchors } from "@components/canvas/interaction/handles";
	import { createPointerDrag } from "@components/canvas/interaction/pointer-drag.svelte";
	import { clientToSvgPoint, getSvgRoot } from "@components/canvas/interaction/svg";
	import { canvasCursor, resizeCursor } from "@components/core/cursors";
	import type { ImageElement } from "@maply/model/types";
	import { Editor, type ResizeHandle } from "editor";

	interface Props {
		element: ImageElement;
		cropEditing: boolean;
	}

	let { element, cropEditing }: Props = $props();

	const HANDLE_SIZE_SCREEN = 10;
	const HANDLE_OFFSET_SCREEN = 1;
	const canvas = Editor.state.canvas;

	let dragKind: "pan" | "resize" | null = $state(null);

	const handleSize = $derived(HANDLE_SIZE_SCREEN / $canvas.camera.zoom);
	const handleOffset = $derived(HANDLE_OFFSET_SCREEN / $canvas.camera.zoom);
	const panCursor = $derived(dragKind === "pan" ? canvasCursor.grabbing : canvasCursor.hand);

	const handles = $derived(resizeAnchors(element));
	const drag = createPointerDrag();

	function beginDrag(
		event: PointerEvent,
		kind: "pan" | "resize",
		svg: SVGSVGElement,
		handle?: ResizeHandle,
		source?: ImageElement
	) {
		const started = drag.start(event, {
			project: (pointerEvent) => clientToSvgPoint(svg, pointerEvent.clientX, pointerEvent.clientY),
			onMove: ({ delta, totalDelta }) => {
				if (kind === "pan") {
					Editor.image.translateCrop(element.id, delta.x, delta.y);
				} else if (handle && source) {
					Editor.image.resizeFrame(element.id, handle, totalDelta.x, totalDelta.y, undefined, source);
				}
			},
			onEnd: () => {
				dragKind = null;
			}
		});
		if (started) dragKind = kind;
	}

	function startPan(event: PointerEvent) {
		if (event.button !== 0) return;
		event.preventDefault();
		event.stopPropagation();

		const svg = getSvgRoot(event.target);
		if (!svg) return;
		beginDrag(event, "pan", svg);
	}

	function startResize(event: PointerEvent, handle: ResizeHandle) {
		if (event.button !== 0) return;
		event.preventDefault();
		event.stopPropagation();

		const svg = getSvgRoot(event.target);
		if (!svg) return;
		beginDrag(event, "resize", svg, handle, { ...element });
	}
</script>

<g class="image-crop-overlay">
	{#if cropEditing}
		<rect
			x={$canvas.x}
			y={$canvas.y}
			width={Math.max(0, element.x - $canvas.x)}
			height={$canvas.height}
			fill="var(--foreground)"
			fill-opacity="0.06"
			pointer-events="none"
		/>
		<rect
			x={element.x + element.width}
			y={$canvas.y}
			width={Math.max(0, $canvas.x + $canvas.width - (element.x + element.width))}
			height={$canvas.height}
			fill="var(--foreground)"
			fill-opacity="0.06"
			pointer-events="none"
		/>
		<rect
			x={element.x}
			y={$canvas.y}
			width={element.width}
			height={Math.max(0, element.y - $canvas.y)}
			fill="var(--foreground)"
			fill-opacity="0.06"
			pointer-events="none"
		/>
		<rect
			x={element.x}
			y={element.y + element.height}
			width={element.width}
			height={Math.max(0, $canvas.y + $canvas.height - (element.y + element.height))}
			fill="var(--foreground)"
			fill-opacity="0.06"
			pointer-events="none"
		/>

		<rect
			x={element.x}
			y={element.y}
			role="button"
			tabindex="-1"
			aria-label="Pan image crop"
			width={element.width}
			height={element.height}
			fill="transparent"
			stroke="var(--canvas-selection)"
			stroke-width={2.5 / $canvas.camera.zoom}
			onpointerdown={startPan}
			style:cursor={panCursor}
		/>

		{#each handles as handle (handle.key)}
			<rect
				x={handle.x - handleSize / 2}
				y={handle.y - handleSize / 2}
				role="button"
				tabindex="-1"
				aria-label="Resize crop frame"
				width={handleSize}
				height={handleSize}
				rx={handleOffset}
				fill="var(--canvas-handle-fill)"
				stroke="var(--canvas-selection)"
				stroke-width={2 / $canvas.camera.zoom}
				style:cursor={resizeCursor(handle.key)}
				onpointerdown={(event) => startResize(event, handle.key)}
			/>
		{/each}
	{/if}
</g>
