<script lang="ts">
	import {
		createCircleElementFromDrag,
		createRectElementFromDrag,
		duplicateElement,
		getShapeDragBox
	} from "$lib/app/core/element-actions";
	import { isPointInsideCanvas, type Point } from "$lib/app/domain/geometry";
	import { canvasState } from "$lib/app/state/canvas.svelte";
	import { copyElement, getClipboardElement } from "$lib/app/state/clipboard.svelte";
	import { projectState } from "$lib/app/state/project.svelte";
	import { toolState } from "$lib/app/state/tool.svelte";
	import * as ContextMenu from "$lib/components/ui/context-menu";
	import { onMount } from "svelte";

	import Artboard from "./Artboard.svelte";
	import Background from "./Background.svelte";

	let container: HTMLDivElement | null = $state(null);
	let contextMenuTarget: "element" | "empty" = $state("empty");
	let contextMenuElementId: string | null = $state(null);

	const hasClipboardElement = $derived(!!getClipboardElement());
	let svgRef: SVGSVGElement | null = $state(null);
	let containerWidth = $state(0);
	let containerHeight = $state(0);
	let isPanning = $state(false);
	let isHovering = $state(false);
	let panStart = $state({ x: 0, y: 0 });
	let cameraStart = $state({ x: 0, y: 0 });
	let drawingSession = $state<{
		tool: "rect" | "circle";
		start: Point;
		current: Point;
		square: boolean;
	} | null>(null);

	const isHandActive = $derived($toolState.activeTool === "hand" || (isHovering && $toolState.isSpacePressed));
	const cursorClass = $derived(() => {
		if (isPanning) return "cursor-grabbing";
		if (isHandActive) return "cursor-grab";
		return "cursor-default";
	});
	const shapePreview = $derived(() => {
		if (!drawingSession) return null;
		const box = getShapeDragBox(drawingSession.start, drawingSession.current, {
			square: drawingSession.tool === "rect" && drawingSession.square
		});
		if (!box) return null;

		if (drawingSession.tool === "rect") {
			return { type: "rect" as const, ...box };
		}

		const diameter = Math.min(box.width, box.height);
		return {
			type: "circle" as const,
			cx: box.x + diameter / 2,
			cy: box.y + diameter / 2,
			r: diameter / 2
		};
	});

	onMount(() => {
		if (!container) return;
		const viewport = container;

		const resizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const rect = entry.contentRect;
				containerWidth = rect.width;
				containerHeight = rect.height;
			}
		});

		resizeObserver.observe(container);

		const initialRect = container.getBoundingClientRect();
		containerWidth = initialRect.width;
		containerHeight = initialRect.height;

		function handleWheel(event: WheelEvent) {
			event.preventDefault();

			if (event.ctrlKey || event.metaKey) {
				// Zoom around the pointer so the world point under the cursor stays fixed.
				const ZOOM_SENSITIVITY = 0.0025;
				const nextZoom = Math.min(
					$canvasState.maxZoom,
					Math.max(
						$canvasState.minZoom,
						$canvasState.camera.zoom * Math.exp(-event.deltaY * ZOOM_SENSITIVITY)
					)
				);
				if (nextZoom === $canvasState.camera.zoom) return;

				const rect = viewport.getBoundingClientRect();
				const mouseX = event.clientX - rect.left;
				const mouseY = event.clientY - rect.top;

				const worldX = $canvasState.camera.x + mouseX / $canvasState.camera.zoom;
				const worldY = $canvasState.camera.y + mouseY / $canvasState.camera.zoom;

				canvasState.setCamera({
					zoom: nextZoom,
					x: worldX - mouseX / nextZoom,
					y: worldY - mouseY / nextZoom
				});
			} else {
				canvasState.pan(event.deltaX / $canvasState.camera.zoom, event.deltaY / $canvasState.camera.zoom);
			}
		}

		function startPan(event: MouseEvent) {
			const canPan = event.button === 1 || (event.button === 0 && isHandActive);
			if (!canPan) return;

			event.preventDefault();
			viewport.focus();
			isPanning = true;
			panStart = { x: event.clientX, y: event.clientY };
			cameraStart = { x: $canvasState.camera.x, y: $canvasState.camera.y };
		}

		function movePan(event: MouseEvent) {
			if (!isPanning) return;
			const dx = (panStart.x - event.clientX) / $canvasState.camera.zoom;
			const dy = (panStart.y - event.clientY) / $canvasState.camera.zoom;
			canvasState.setCamera({
				x: cameraStart.x + dx,
				y: cameraStart.y + dy
			});
		}

		function endPan() {
			isPanning = false;
		}

		function moveDrawing(event: PointerEvent) {
			if (!drawingSession) return;
			const point = clientToSvgPoint(event.clientX, event.clientY);
			if (!point) return;
			drawingSession = { ...drawingSession, current: point, square: event.shiftKey };
		}

		function endDrawing(event: PointerEvent) {
			if (!drawingSession) return;
			event.preventDefault();
			const session = drawingSession;
			const end = clientToSvgPoint(event.clientX, event.clientY) ?? session.current;
			drawingSession = null;

			const element =
				session.tool === "rect"
					? createRectElementFromDrag(session.start, end, $projectState.elements, {
							square: event.shiftKey
						})
					: createCircleElementFromDrag(session.start, end, $projectState.elements);
			if (!element) return;

			projectState.addElement(element);
			toolState.setTool("select");
		}

		function cancelDrawing() {
			drawingSession = null;
		}

		function handleKeyDown(event: KeyboardEvent) {
			if (event.key !== " ") return;
			if (!isHovering) return;
			event.preventDefault();
			toolState.setSpacePressed(true);
		}

		function handleKeyUp(event: KeyboardEvent) {
			if (event.key !== " ") return;
			event.preventDefault();
			toolState.setSpacePressed(false);
		}

		function handleMouseEnter() {
			isHovering = true;
		}

		function handleMouseLeave() {
			isHovering = false;
			toolState.setSpacePressed(false);
		}

		// Global move/up handlers keep panning stable after the pointer leaves the viewport.
		viewport.addEventListener("wheel", handleWheel, { passive: false });
		viewport.addEventListener("mousedown", startPan);
		viewport.addEventListener("mouseenter", handleMouseEnter);
		viewport.addEventListener("mouseleave", handleMouseLeave);
		window.addEventListener("mousemove", movePan);
		window.addEventListener("mouseup", endPan);
		window.addEventListener("pointermove", moveDrawing);
		window.addEventListener("pointerup", endDrawing);
		window.addEventListener("pointercancel", cancelDrawing);
		window.addEventListener("keydown", handleKeyDown);
		window.addEventListener("keyup", handleKeyUp);

		return () => {
			resizeObserver.disconnect();
			viewport.removeEventListener("wheel", handleWheel);
			viewport.removeEventListener("mousedown", startPan);
			viewport.removeEventListener("mouseenter", handleMouseEnter);
			viewport.removeEventListener("mouseleave", handleMouseLeave);
			window.removeEventListener("mousemove", movePan);
			window.removeEventListener("mouseup", endPan);
			window.removeEventListener("pointermove", moveDrawing);
			window.removeEventListener("pointerup", endDrawing);
			window.removeEventListener("pointercancel", cancelDrawing);
			window.removeEventListener("keydown", handleKeyDown);
			window.removeEventListener("keyup", handleKeyUp);
		};
	});

	const viewBox = $derived(
		`${$canvasState.camera.x} ${$canvasState.camera.y} ${containerWidth / $canvasState.camera.zoom} ${containerHeight / $canvasState.camera.zoom}`
	);

	function clientToSvgPoint(clientX: number, clientY: number): Point | null {
		if (!svgRef) return null;
		const ctm = svgRef.getScreenCTM();
		if (!ctm) return null;

		const point = svgRef.createSVGPoint();
		point.x = clientX;
		point.y = clientY;
		const svgPoint = point.matrixTransform(ctm.inverse());
		return { x: svgPoint.x, y: svgPoint.y };
	}

	function isShapeTool(tool: string): tool is "rect" | "circle" {
		return tool === "rect" || tool === "circle";
	}

	function handleSvgPointerDown(event: PointerEvent) {
		if (event.button !== 0) return;
		if ($toolState.activeTool === "select") {
			projectState.selectElement(null);
			return;
		}

		if (!isShapeTool($toolState.activeTool)) return;

		const drawPoint = clientToSvgPoint(event.clientX, event.clientY);
		if (!drawPoint) return;
		const insideArtboard = isPointInsideCanvas(drawPoint, {
			x: $canvasState.x,
			y: $canvasState.y,
			width: $canvasState.width,
			height: $canvasState.height
		});

		if (!insideArtboard) return;

		event.preventDefault();
		event.stopPropagation();
		drawingSession = {
			tool: $toolState.activeTool,
			start: drawPoint,
			current: drawPoint,
			square: event.shiftKey
		};
	}

	function handleContextMenu(event: MouseEvent) {
		const target = event.target as Element | null;
		const elementNode = target?.closest("[data-canvas-element]");
		if (elementNode instanceof Element) {
			const id = elementNode.getAttribute("data-canvas-element");
			if (id) {
				contextMenuTarget = "element";
				contextMenuElementId = id;
				projectState.selectElement(id);
				return;
			}
		}
		contextMenuTarget = "empty";
		contextMenuElementId = null;
	}

	function handleCopy() {
		if (!contextMenuElementId) return;
		const element = $projectState.elements.find((e) => e.id === contextMenuElementId);
		if (element) copyElement(element);
	}

	function handleDelete() {
		if (!contextMenuElementId) return;
		projectState.deleteElement(contextMenuElementId);
	}

	function handlePaste() {
		const copied = getClipboardElement();
		if (!copied) return;
		projectState.addElement(duplicateElement(copied, $projectState.elements));
	}
</script>

<ContextMenu.Root>
	<ContextMenu.Trigger class="contents">
		<div
			bind:this={container}
			class="canvas-viewport bg-muted relative min-h-0 flex-1 overflow-hidden outline-none {cursorClass()}"
			role="application"
			aria-label="Canvas workspace"
			tabindex="-1"
			oncontextmenu={handleContextMenu}
		>
			{#if containerWidth > 0 && containerHeight > 0}
				<svg
					bind:this={svgRef}
					width="100%"
					height="100%"
					{viewBox}
					role="img"
					aria-label="Canvas workspace"
					onpointerdown={handleSvgPointerDown}
				>
					<Background {containerWidth} {containerHeight} camera={$canvasState.camera} />
					<Artboard />
					{#if shapePreview()}
						{@const preview = shapePreview()!}
						{#if preview.type === "rect"}
							<rect
								x={preview.x}
								y={preview.y}
								width={preview.width}
								height={preview.height}
								fill="var(--primary)"
								fill-opacity="0.12"
								stroke="var(--primary)"
								stroke-width="1"
								pointer-events="none"
							/>
						{:else}
							<circle
								cx={preview.cx}
								cy={preview.cy}
								r={preview.r}
								fill="var(--primary)"
								fill-opacity="0.12"
								stroke="var(--primary)"
								stroke-width="1"
								pointer-events="none"
							/>
						{/if}
					{/if}
				</svg>
			{/if}
		</div>
	</ContextMenu.Trigger>
	<ContextMenu.Content>
		{#if contextMenuTarget === "element"}
			<ContextMenu.Item onclick={handleCopy}>Copy</ContextMenu.Item>
			<ContextMenu.Item variant="destructive" onclick={handleDelete}>Delete</ContextMenu.Item>
		{:else}
			<ContextMenu.Item disabled={!hasClipboardElement} onclick={handlePaste}>Paste</ContextMenu.Item>
		{/if}
	</ContextMenu.Content>
</ContextMenu.Root>
