<script lang="ts">
	import { resizeCursor } from "@components/core/cursors";
	import type { Element } from "@maply/model/types";
	import { Editor, type ResizeHandle } from "editor";
	import { onMount } from "svelte";

	interface Props {
		element: Element;
		interactive?: boolean;
	}

	let { element, interactive = true }: Props = $props();
	const canvas = Editor.state.canvas;
	const project = Editor.state.project;
	const tool = Editor.state.tool;
	const hideOutline = $derived(element.type === "image" && $project.cropEditingElementId === element.id);
	const isSingleSelection = $derived($project.selectedElementIds.length === 1);
	const canResize = $derived(
		interactive &&
			!hideOutline &&
			$tool.activeTool === "select" &&
			isSingleSelection &&
			$project.selectedElementId === element.id &&
			(element.type === "rect" ||
				element.type === "text" ||
				element.type === "image" ||
				element.type === "circle")
	);
	const HANDLE_SIZE_SCREEN = 10;
	const HANDLE_OFFSET_SCREEN = 1;
	const SELECTION_COLOR = "#2563eb";

	let bbox = $state({ x: 0, y: 0, width: 0, height: 0 });
	let dragState = $state<
		| {
				kind: "move";
				id: string;
				ids: string[];
				svg: SVGSVGElement;
				grabX: number;
				grabY: number;
				toggleSelectionOnClick: boolean;
				didMove: boolean;
		  }
		| {
				kind: "resize";
				handle: ResizeHandle;
				svg: SVGSVGElement;
				grabX: number;
				grabY: number;
				lockAspectRatio: boolean;
				aspectRatio: number | null;
				didMove: boolean;
		  }
		| null
	>(null);

	const strokeWidth = $derived(2.5 / $canvas.camera.zoom);
	const handleStrokeWidth = $derived(2 / $canvas.camera.zoom);
	const handleSize = $derived(HANDLE_SIZE_SCREEN / $canvas.camera.zoom);
	const handleOffset = $derived(HANDLE_OFFSET_SCREEN / $canvas.camera.zoom);
	const handles = $derived([
		{ key: "nw" as const, x: bbox.x, y: bbox.y },
		{ key: "n" as const, x: bbox.x + bbox.width / 2, y: bbox.y },
		{ key: "ne" as const, x: bbox.x + bbox.width, y: bbox.y },
		{ key: "e" as const, x: bbox.x + bbox.width, y: bbox.y + bbox.height / 2 },
		{ key: "se" as const, x: bbox.x + bbox.width, y: bbox.y + bbox.height },
		{ key: "s" as const, x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height },
		{ key: "sw" as const, x: bbox.x, y: bbox.y + bbox.height },
		{ key: "w" as const, x: bbox.x, y: bbox.y + bbox.height / 2 }
	]);

	$effect(() => {
		if (element.type === "text" || element.type === "image") {
			const padding = 0.5;
			const textBounds = Editor.geometry.elementBounds(element);
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

	function startSelectionDrag(event: PointerEvent) {
		if (event.button !== 0) return;
		if ($tool.activeTool !== "select") return;

		event.stopPropagation();
		const wasSelected = $project.selectedElementIds.includes(element.id);
		const wasMultiSelected = $project.selectedElementIds.length > 1;

		if (event.ctrlKey || event.metaKey) {
			event.preventDefault();
			if (!wasSelected) {
				Editor.selection.select(element.id, true);
				dragState = null;
				return;
			}
		} else if (!wasSelected) {
			Editor.selection.select(element.id);
		}

		const svg = getSvgRoot(event.target);
		if (!svg) return;

		const svgPoint = clientToSvgPoint(svg, event.clientX, event.clientY);
		if (!svgPoint) return;

		const ids = wasSelected && wasMultiSelected ? [...$project.selectedElementIds] : [element.id];
		dragState = {
			kind: "move",
			id: element.id,
			ids,
			svg,
			grabX: svgPoint.x,
			grabY: svgPoint.y,
			toggleSelectionOnClick: (event.ctrlKey || event.metaKey) && wasSelected,
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
		const bounds = Editor.geometry.elementBounds(element);
		const aspectRatio = bounds.height > 0 ? bounds.width / bounds.height : null;

		dragState = {
			kind: "resize",
			handle,
			svg,
			grabX: svgPoint.x,
			grabY: svgPoint.y,
			lockAspectRatio: event.shiftKey,
			aspectRatio,
			didMove: false
		};
	}

	onMount(() => {
		function handlePointerMove(event: PointerEvent) {
			if (!dragState) return;

			if (dragState.kind === "move") {
				const svgPoint = clientToSvgPoint(dragState.svg, event.clientX, event.clientY);
				if (!svgPoint) return;

				const dx = svgPoint.x - dragState.grabX;
				const dy = svgPoint.y - dragState.grabY;
				if (dx === 0 && dy === 0) return;

				dragState.didMove = true;
				if (dragState.ids.length > 1) {
					Editor.element.translateAll(dragState.ids, dx, dy);
				} else {
					Editor.element.translate(dragState.ids[0], dx, dy);
				}
				dragState.grabX = svgPoint.x;
				dragState.grabY = svgPoint.y;
				return;
			}

			const svgPoint = clientToSvgPoint(dragState.svg, event.clientX, event.clientY);
			if (!svgPoint) return;

			const dx = svgPoint.x - dragState.grabX;
			const dy = svgPoint.y - dragState.grabY;
			if (dx === 0 && dy === 0) return;

			dragState.didMove = true;
			Editor.element.resize(element.id, dragState.handle, dx, dy, {
				lockAspectRatio: dragState.lockAspectRatio,
				aspectRatio: dragState.aspectRatio ?? undefined
			});
			dragState.grabX = svgPoint.x;
			dragState.grabY = svgPoint.y;
		}

		function stopDragging() {
			if (dragState?.kind === "move" && dragState.toggleSelectionOnClick && !dragState.didMove) {
				Editor.selection.select(dragState.id, true);
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
	stroke={hideOutline ? "transparent" : SELECTION_COLOR}
	stroke-dasharray={undefined}
	pointer-events={interactive && !hideOutline ? "all" : "none"}
	style:cursor="inherit"
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
			fill="white"
			stroke={SELECTION_COLOR}
			stroke-width={handleStrokeWidth}
			style:cursor={resizeCursor(handle.key)}
			onpointerdown={(event) => startResize(event, handle.key)}
		/>
	{/each}
{/if}
