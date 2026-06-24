<script lang="ts">
	import type { ResizeHandle } from "$lib/app/core/element-actions";
	import type { ImageElement } from "$lib/app/domain/elements";
	import { canvasState } from "$lib/app/state/canvas.svelte";
	import { projectState } from "$lib/app/state/project.svelte";
	import { onMount } from "svelte";

	interface Props {
		element: ImageElement;
		cropEditing: boolean;
	}

	let { element, cropEditing }: Props = $props();

	const HANDLE_SIZE_SCREEN = 10;
	const HANDLE_OFFSET_SCREEN = 1;

	let dragState = $state<
		| {
				kind: "pan";
				grabX: number;
				grabY: number;
		  }
		| {
				kind: "resize";
				handle: ResizeHandle;
				grabX: number;
				grabY: number;
		  }
		| null
	>(null);

	const handleSize = $derived(HANDLE_SIZE_SCREEN / $canvasState.camera.zoom);
	const handleOffset = $derived(HANDLE_OFFSET_SCREEN / $canvasState.camera.zoom);
	const panCursor = $derived(dragState?.kind === "pan" ? "grabbing" : "default");

	const handles = $derived([
		{ key: "nw" as const, x: element.x, y: element.y, cursor: "nwse-resize" },
		{ key: "n" as const, x: element.x + element.width / 2, y: element.y, cursor: "ns-resize" },
		{ key: "ne" as const, x: element.x + element.width, y: element.y, cursor: "nesw-resize" },
		{ key: "e" as const, x: element.x + element.width, y: element.y + element.height / 2, cursor: "ew-resize" },
		{ key: "se" as const, x: element.x + element.width, y: element.y + element.height, cursor: "nwse-resize" },
		{ key: "s" as const, x: element.x + element.width / 2, y: element.y + element.height, cursor: "ns-resize" },
		{ key: "sw" as const, x: element.x, y: element.y + element.height, cursor: "nesw-resize" },
		{ key: "w" as const, x: element.x, y: element.y + element.height / 2, cursor: "ew-resize" }
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

			const dx = svgPoint.x - dragState.grabX;
			const dy = svgPoint.y - dragState.grabY;

			if (dragState.kind === "pan") {
				projectState.translateImageCrop(element.id, dx, dy);
			} else {
				projectState.resizeImageFrame(element.id, dragState.handle, dx, dy);
			}

			dragState.grabX = svgPoint.x;
			dragState.grabY = svgPoint.y;
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
			x={$canvasState.x}
			y={$canvasState.y}
			width={Math.max(0, element.x - $canvasState.x)}
			height={$canvasState.height}
			fill="var(--foreground)"
			fill-opacity="0.06"
			pointer-events="none"
		/>
		<rect
			x={element.x + element.width}
			y={$canvasState.y}
			width={Math.max(0, $canvasState.x + $canvasState.width - (element.x + element.width))}
			height={$canvasState.height}
			fill="var(--foreground)"
			fill-opacity="0.06"
			pointer-events="none"
		/>
		<rect
			x={element.x}
			y={$canvasState.y}
			width={element.width}
			height={Math.max(0, element.y - $canvasState.y)}
			fill="var(--foreground)"
			fill-opacity="0.06"
			pointer-events="none"
		/>
		<rect
			x={element.x}
			y={element.y + element.height}
			width={element.width}
			height={Math.max(0, $canvasState.y + $canvasState.height - (element.y + element.height))}
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
			stroke="var(--primary)"
			stroke-width={1.25 / $canvasState.camera.zoom}
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
				fill="var(--background)"
				stroke="var(--primary)"
				stroke-width={1 / $canvasState.camera.zoom}
				class={handle.cursor}
				onpointerdown={(event) => startResize(event, handle.key)}
			/>
		{/each}
	{/if}
</g>
