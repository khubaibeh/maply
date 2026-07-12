<script lang="ts">
	import { canvasCursor, resizeCursor } from "@components/core/cursors";
	import type { ImageElement } from "@maply/model/types";
	import { Editor, type ResizeHandle } from "editor";
	import { onMount } from "svelte";

	interface Props {
		element: ImageElement;
		cropEditing: boolean;
	}

	let { element, cropEditing }: Props = $props();

	const HANDLE_SIZE_SCREEN = 10;
	const HANDLE_OFFSET_SCREEN = 1;
	const SELECTION_COLOR = "#2563eb";
	const canvas = Editor.state.canvas;

	let dragState = $state<
		| {
				kind: "pan";
				svg: SVGSVGElement;
				grabX: number;
				grabY: number;
		  }
		| {
				kind: "resize";
				handle: ResizeHandle;
				svg: SVGSVGElement;
				grabX: number;
				grabY: number;
				source: ImageElement;
		  }
		| null
	>(null);

	const handleSize = $derived(HANDLE_SIZE_SCREEN / $canvas.camera.zoom);
	const handleOffset = $derived(HANDLE_OFFSET_SCREEN / $canvas.camera.zoom);
	const panCursor = $derived(dragState?.kind === "pan" ? canvasCursor.grabbing : canvasCursor.hand);

	const handles = $derived([
		{ key: "nw" as const, x: element.x, y: element.y },
		{ key: "n" as const, x: element.x + element.width / 2, y: element.y },
		{ key: "ne" as const, x: element.x + element.width, y: element.y },
		{ key: "e" as const, x: element.x + element.width, y: element.y + element.height / 2 },
		{ key: "se" as const, x: element.x + element.width, y: element.y + element.height },
		{ key: "s" as const, x: element.x + element.width / 2, y: element.y + element.height },
		{ key: "sw" as const, x: element.x, y: element.y + element.height },
		{ key: "w" as const, x: element.x, y: element.y + element.height / 2 }
	]);

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

	function startPan(event: PointerEvent) {
		if (event.button !== 0) return;
		event.preventDefault();
		event.stopPropagation();

		const svg = getSvgRoot(event.target);
		if (!svg) return;
		const svgPoint = clientToSvgPoint(svg, event.clientX, event.clientY);
		if (!svgPoint) return;

		dragState = {
			kind: "pan",
			svg,
			grabX: svgPoint.x,
			grabY: svgPoint.y
		};
	}

	function startResize(event: PointerEvent, handle: ResizeHandle) {
		if (event.button !== 0) return;
		event.preventDefault();
		event.stopPropagation();

		const svg = getSvgRoot(event.target);
		if (!svg) return;
		const svgPoint = clientToSvgPoint(svg, event.clientX, event.clientY);
		if (!svgPoint) return;

		dragState = {
			kind: "resize",
			handle,
			svg,
			grabX: svgPoint.x,
			grabY: svgPoint.y,
			source: { ...element }
		};
	}

	onMount(() => {
		function handlePointerMove(event: PointerEvent) {
			if (!dragState) return;

			const svgPoint = clientToSvgPoint(dragState.svg, event.clientX, event.clientY);
			if (!svgPoint) return;

			const dx = svgPoint.x - dragState.grabX;
			const dy = svgPoint.y - dragState.grabY;

			if (dragState.kind === "pan") {
				Editor.image.translateCrop(element.id, dx, dy);
				dragState.grabX = svgPoint.x;
				dragState.grabY = svgPoint.y;
			} else {
				Editor.image.resizeFrame(element.id, dragState.handle, dx, dy, undefined, dragState.source);
			}
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
			stroke={SELECTION_COLOR}
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
				fill="white"
				stroke={SELECTION_COLOR}
				stroke-width={2 / $canvas.camera.zoom}
				style:cursor={resizeCursor(handle.key)}
				onpointerdown={(event) => startResize(event, handle.key)}
			/>
		{/each}
	{/if}
</g>
