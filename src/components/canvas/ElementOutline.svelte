<script lang="ts">
	import { App } from "@app";
	import type { Element, ResizeHandle } from "@app/types";
	import { onMount } from "svelte";

	interface Props {
		element: Element;
		interactive?: boolean;
	}

	let { element, interactive = true }: Props = $props();
	const canvas = App.state.canvas;
	const project = App.state.project;
	const tool = App.state.tool;
	const hideOutline = $derived(element.type === "image" && $project.cropEditingElementId === element.id);
	const canResize = $derived(
		interactive &&
			!hideOutline &&
			$tool.activeTool === "select" &&
			$project.selectedElementId === element.id &&
			(element.type === "rect" ||
				element.type === "text" ||
				element.type === "image" ||
				element.type === "circle")
	);
	const HANDLE_SIZE_SCREEN = 10;
	const HANDLE_OFFSET_SCREEN = 1;

	let bbox = $state({ x: 0, y: 0, width: 0, height: 0 });
	let dragState = $state<
		| {
				kind: "move";
				elementX: number;
				elementY: number;
				grabX: number;
				grabY: number;
				wasSelected: boolean;
				didMove: boolean;
		  }
		| {
				kind: "resize";
				handle: ResizeHandle;
				grabX: number;
				grabY: number;
				didMove: boolean;
		  }
		| null
	>(null);

	const strokeWidth = $derived(canResize ? 2.5 / $canvas.camera.zoom : 0.5);
	const handleStrokeWidth = $derived(2 / $canvas.camera.zoom);
	const handleSize = $derived(HANDLE_SIZE_SCREEN / $canvas.camera.zoom);
	const handleOffset = $derived(HANDLE_OFFSET_SCREEN / $canvas.camera.zoom);
	const handles = $derived([
		{ key: "nw" as const, x: bbox.x, y: bbox.y, cursor: "nwse-resize" },
		{ key: "n" as const, x: bbox.x + bbox.width / 2, y: bbox.y, cursor: "ns-resize" },
		{ key: "ne" as const, x: bbox.x + bbox.width, y: bbox.y, cursor: "nesw-resize" },
		{ key: "e" as const, x: bbox.x + bbox.width, y: bbox.y + bbox.height / 2, cursor: "ew-resize" },
		{ key: "se" as const, x: bbox.x + bbox.width, y: bbox.y + bbox.height, cursor: "nwse-resize" },
		{ key: "s" as const, x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height, cursor: "ns-resize" },
		{ key: "sw" as const, x: bbox.x, y: bbox.y + bbox.height, cursor: "nesw-resize" },
		{ key: "w" as const, x: bbox.x, y: bbox.y + bbox.height / 2, cursor: "ew-resize" }
	]);

	$effect(() => {
		if (element.type === "text" || element.type === "image") {
			const padding = 0.5;
			const textBounds = App.geometry.elementBounds(element);
			bbox = {
				x: textBounds.x - padding,
				y: textBounds.y - padding,
				width: textBounds.width + padding * 2,
				height: textBounds.height + padding * 2
			};
			return;
		}

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
		const padding = 0.5;

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
		if ($tool.activeTool !== "select") return;

		event.stopPropagation();
		const wasSelected = $project.selectedElementId === element.id;
		if (!wasSelected) {
			App.actions.project.selectElement(element.id);
		}

		const svg = getSvgRoot(event.target);
		if (!svg) return;

		const svgPoint = clientToSvgPoint(svg, event.clientX, event.clientY);
		if (!svgPoint) return;

		const origin = getElementOrigin();
		dragState = {
			kind: "move",
			elementX: origin.x,
			elementY: origin.y,
			grabX: svgPoint.x,
			grabY: svgPoint.y,
			wasSelected,
			didMove: false
		};
	}

	function startResize(event: PointerEvent, handle: ResizeHandle) {
		if (event.button !== 0) return;
		if (!canResize) return;

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
			grabY: svgPoint.y,
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

			if (dragState.kind === "move") {
				const nextX = dragState.elementX + (svgPoint.x - dragState.grabX);
				const nextY = dragState.elementY + (svgPoint.y - dragState.grabY);
				dragState.didMove = true;
				App.actions.project.setElementPosition(element.id, nextX, nextY);
				return;
			}

			const dx = svgPoint.x - dragState.grabX;
			const dy = svgPoint.y - dragState.grabY;
			if (dx === 0 && dy === 0) return;

			dragState.didMove = true;
			App.actions.project.resizeElement(element.id, dragState.handle, dx, dy);
			dragState.grabX = svgPoint.x;
			dragState.grabY = svgPoint.y;
		}

		function stopDragging() {
			if (dragState?.kind === "move" && dragState.wasSelected && !dragState.didMove) {
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
	stroke-width={strokeWidth}
	stroke={hideOutline ? "transparent" : "var(--primary)"}
	stroke-dasharray={undefined}
	pointer-events={interactive && !hideOutline ? "all" : "none"}
	class="cursor-inherit"
	onpointerdown={startSelectionDrag}
/>

{#if canResize}
	{#each handles as handle (handle.key)}
		<rect
			x={handle.x - handleSize / 2}
			y={handle.y - handleSize / 2}
			role="button"
			tabindex="-1"
			aria-label="Resize {element.name}"
			width={handleSize}
			height={handleSize}
			rx={handleOffset}
			fill="var(--background)"
			stroke="var(--primary)"
			stroke-width={handleStrokeWidth}
			class={handle.cursor}
			onpointerdown={(event) => startResize(event, handle.key)}
		/>
	{/each}
{/if}
