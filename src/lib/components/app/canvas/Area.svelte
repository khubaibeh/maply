<script lang="ts">
	import {
		createCircleElementFromDrag,
		createImageElementFromDrag,
		createPathElementFromPoints,
		createRectElementFromDrag,
		createTextElementFromDrag,
		getShapeDragBox
	} from "$lib/app/core/element-actions";
	import type { ImageElement } from "$lib/app/domain/elements";
	import { isPointInsideCanvas, type Point } from "$lib/app/domain/geometry";
	import { canvasState } from "$lib/app/state/canvas.svelte";
	import { copyElement, getClipboardElement } from "$lib/app/state/clipboard.svelte";
	import { projectState } from "$lib/app/state/project.svelte";
	import { toolState } from "$lib/app/state/tool.svelte";
	import penToolSvg from "$lib/assets/pen-tool.svg?raw";
	import plusSvg from "$lib/assets/plus.svg?raw";
	import * as ContextMenu from "$lib/components/ui/context-menu";
	import { onMount } from "svelte";

	import Artboard from "./Artboard.svelte";
	import Background from "./Background.svelte";
	import ImageCropToolbar from "./ImageCropToolbar.svelte";

	let container: HTMLDivElement | null = $state(null);
	let contextMenuOpen = $state(false);
	let contextMenuTarget: "element" | "empty" = $state("empty");
	let contextMenuElementId: string | null = $state(null);

	const hasClipboardElement = $derived(!!getClipboardElement());
	const contextMenuElementLayerIndex = $derived(
		contextMenuElementId ? $projectState.elements.findIndex((element) => element.id === contextMenuElementId) : -1
	);
	const contextMenuElementIsFrontmost = $derived(contextMenuElementLayerIndex === $projectState.elements.length - 1);
	const contextMenuElementIsBackmost = $derived(contextMenuElementLayerIndex === 0);
	const selectedImage = $derived(
		($projectState.elements.find(
			(element) => element.id === $projectState.selectedElementId && element.type === "image"
		) ?? null) as ImageElement | null
	);
	const cropEditing = $derived(
		$projectState.cropEditingElementId === $projectState.selectedElementId && selectedImage !== null
	);
	let svgRef: SVGSVGElement | null = $state(null);
	let containerWidth = $state(0);
	let containerHeight = $state(0);
	let isPanning = $state(false);
	let isHovering = $state(false);
	let panStart = $state({ x: 0, y: 0 });
	let cameraStart = $state({ x: 0, y: 0 });
	let drawingSession = $state<{
		tool: "rect" | "circle" | "text" | "image";
		start: Point;
		current: Point;
		square: boolean;
	} | null>(null);
	let pathSession = $state<{
		points: Point[];
		current: Point;
		nearFirst: boolean;
		nearLast: boolean;
	} | null>(null);

	const CLOSE_THRESHOLD_SCREEN_PX = 12;
	const VERTEX_DOT_SCREEN_PX = 3;
	const CLOSE_HANDLE_SCREEN_PX = 6;

	$effect(() => {
		if ($toolState.activeTool !== "path" && pathSession) {
			pathSession = null;
		}
	});

	const isHandActive = $derived($toolState.activeTool === "hand" || (isHovering && $toolState.isSpacePressed));
	const cursorClass = $derived(() => {
		if (isPanning) return "cursor-grabbing";
		if (isHandActive) return "cursor-grab";
		return "cursor-default";
	});

	function svgCursorUrl(svg: string, hotspotX = 12, hotspotY = 12): string {
		return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") ${hotspotX} ${hotspotY}, none`;
	}

	const toolCursor = $derived(() => {
		if (isPanning || isHandActive) return undefined;

		const tool = $toolState.activeTool;
		if (tool === "rect" || tool === "circle" || tool === "text" || tool === "image") return svgCursorUrl(plusSvg);
		if (tool === "path") return svgCursorUrl(penToolSvg, 6, 6);
		return undefined;
	});

	const shapePreview = $derived(() => {
		if (!drawingSession) return null;
		const box = getShapeDragBox(drawingSession.start, drawingSession.current, {
			square: drawingSession.tool === "rect" && drawingSession.square
		});
		if (!box) return null;

		if (drawingSession.tool === "rect" || drawingSession.tool === "text" || drawingSession.tool === "image") {
			return { type: drawingSession.tool, ...box };
		}

		const diameter = Math.min(box.width, box.height);
		return {
			type: "circle" as const,
			cx: box.x + diameter / 2,
			cy: box.y + diameter / 2,
			r: diameter / 2
		};
	});

	const pathPreviewRadius = $derived(CLOSE_HANDLE_SCREEN_PX / $canvasState.camera.zoom);
	const pathVertexRadius = $derived(VERTEX_DOT_SCREEN_PX / $canvasState.camera.zoom);

	function distance(a: Point, b: Point): number {
		const dx = a.x - b.x;
		const dy = a.y - b.y;
		return Math.sqrt(dx * dx + dy * dy);
	}

	function clampPointToCanvas(point: Point): Point {
		return {
			x: Math.max($canvasState.x, Math.min($canvasState.x + $canvasState.width, point.x)),
			y: Math.max($canvasState.y, Math.min($canvasState.y + $canvasState.height, point.y))
		};
	}

	function updatePathSessionCurrent(point: Point) {
		if (!pathSession) return;
		const clampedPoint = clampPointToCanvas(point);
		const first = pathSession.points[0];
		const last = pathSession.points[pathSession.points.length - 1];
		const threshold = CLOSE_THRESHOLD_SCREEN_PX / $canvasState.camera.zoom;
		const nearFirst = first ? distance(first, clampedPoint) <= threshold : false;
		const nearLast =
			!nearFirst && pathSession.points.length >= 2 && last ? distance(last, clampedPoint) <= threshold : false;
		pathSession = {
			...pathSession,
			current: clampedPoint,
			nearFirst,
			nearLast
		};
	}

	function commitPath(closed: boolean) {
		if (!pathSession) return;
		const points = pathSession.points;
		pathSession = null;

		const element = createPathElementFromPoints(points, closed, $projectState.elements);
		if (!element) return;

		projectState.addElement(element);
		toolState.setTool("select");
	}

	function closePath() {
		if (!pathSession || pathSession.points.length < 3) return;
		commitPath(true);
	}

	function cancelPath() {
		pathSession = null;
	}

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
			const cropEditingElement = $projectState.cropEditingElementId
				? $projectState.elements.find((element) => element.id === $projectState.cropEditingElementId)
				: null;

			if (cropEditingElement?.type === "image") {
				const point = clientToSvgPoint(event.clientX, event.clientY);
				if (
					point &&
					point.x >= cropEditingElement.x &&
					point.x <= cropEditingElement.x + cropEditingElement.width &&
					point.y >= cropEditingElement.y &&
					point.y <= cropEditingElement.y + cropEditingElement.height
				) {
					event.preventDefault();
					return;
				}
			}

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
			drawingSession = { ...drawingSession, current: clampPointToCanvas(point), square: event.shiftKey };
		}

		function movePathDrawing(event: PointerEvent) {
			if (!pathSession) return;
			const point = clientToSvgPoint(event.clientX, event.clientY);
			if (!point) return;
			updatePathSessionCurrent(point);
		}

		function endDrawing(event: PointerEvent) {
			if (!drawingSession) return;
			event.preventDefault();
			const session = drawingSession;
			const endPoint = clientToSvgPoint(event.clientX, event.clientY);
			const end = endPoint ? clampPointToCanvas(endPoint) : session.current;
			drawingSession = null;

			let element = null;
			if (session.tool === "rect") {
				element = createRectElementFromDrag(session.start, end, $projectState.elements, {
					square: event.shiftKey
				});
			} else if (session.tool === "circle") {
				element = createCircleElementFromDrag(session.start, end, $projectState.elements);
			} else if (session.tool === "text") {
				element = createTextElementFromDrag(session.start, end, $projectState.elements);
			} else if (session.tool === "image") {
				element = createImageElementFromDrag(session.start, end, $projectState.elements);
			}
			if (!element) return;

			projectState.addElement(element);
			toolState.setTool("select");
		}

		function cancelDrawing() {
			drawingSession = null;
		}

		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === "Escape" && pathSession) {
				event.preventDefault();
				cancelPath();
				return;
			}

			if (event.key === "Enter" && pathSession) {
				event.preventDefault();
				commitPath(pathSession.nearFirst);
				return;
			}

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

		function dismissContextMenu(event: PointerEvent) {
			if (event.button !== 0 || !contextMenuOpen) return;
			if (event.target instanceof Element && event.target.closest('[data-slot="context-menu-content"]')) {
				return;
			}
			contextMenuOpen = false;
		}

		// Global move/up handlers keep panning stable after the pointer leaves the viewport.
		viewport.addEventListener("wheel", handleWheel, { passive: false });
		viewport.addEventListener("mousedown", startPan);
		viewport.addEventListener("mouseenter", handleMouseEnter);
		viewport.addEventListener("mouseleave", handleMouseLeave);
		window.addEventListener("mousemove", movePan);
		window.addEventListener("mouseup", endPan);
		window.addEventListener("pointermove", moveDrawing);
		window.addEventListener("pointermove", movePathDrawing);
		window.addEventListener("pointerup", endDrawing);
		window.addEventListener("pointercancel", cancelDrawing);
		window.addEventListener("pointerdown", dismissContextMenu, true);
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
			window.removeEventListener("pointermove", movePathDrawing);
			window.removeEventListener("pointerup", endDrawing);
			window.removeEventListener("pointercancel", cancelDrawing);
			window.removeEventListener("pointerdown", dismissContextMenu, true);
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

	function isShapeDrawingTool(tool: string): tool is "rect" | "circle" | "text" | "image" {
		return tool === "rect" || tool === "circle" || tool === "text" || tool === "image";
	}

	function handleSvgPointerDown(event: PointerEvent) {
		if (event.button !== 0) return;
		if ($toolState.activeTool === "select") {
			projectState.selectElement(null);
			return;
		}

		const drawPoint = clientToSvgPoint(event.clientX, event.clientY);
		if (!drawPoint) return;
		const insideArtboard = isPointInsideCanvas(drawPoint, {
			x: $canvasState.x,
			y: $canvasState.y,
			width: $canvasState.width,
			height: $canvasState.height,
			color: $canvasState.color
		});

		if (!insideArtboard) return;

		event.preventDefault();
		event.stopPropagation();

		if ($toolState.activeTool === "path") {
			if (pathSession) {
				if (pathSession.nearFirst) {
					closePath();
				} else if (pathSession.nearLast) {
					commitPath(false);
				} else {
					pathSession = {
						...pathSession,
						points: [...pathSession.points, drawPoint]
					};
					updatePathSessionCurrent(drawPoint);
				}
			} else {
				pathSession = {
					points: [drawPoint],
					current: drawPoint,
					nearFirst: false,
					nearLast: false
				};
			}
			return;
		}

		if (!isShapeDrawingTool($toolState.activeTool)) return;

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
		contextMenuOpen = false;
	}

	function handleDelete() {
		if (!contextMenuElementId) return;
		projectState.deleteElement(contextMenuElementId);
		contextMenuOpen = false;
	}

	function handleBringToFront() {
		if (!contextMenuElementId) return;
		projectState.moveElementToFront(contextMenuElementId);
		contextMenuOpen = false;
	}

	function handleBringForward() {
		if (!contextMenuElementId) return;
		projectState.moveElementForward(contextMenuElementId);
		contextMenuOpen = false;
	}

	function handleSendBackward() {
		if (!contextMenuElementId) return;
		projectState.moveElementBackward(contextMenuElementId);
		contextMenuOpen = false;
	}

	function handleSendToBack() {
		if (!contextMenuElementId) return;
		projectState.moveElementToBack(contextMenuElementId);
		contextMenuOpen = false;
	}

	function handlePaste() {
		const copied = getClipboardElement();
		if (!copied) return;
		void projectState.pasteClipboardElement();
		contextMenuOpen = false;
	}
</script>

<ContextMenu.Root bind:open={contextMenuOpen}>
	<ContextMenu.Trigger class="contents">
		<div
			bind:this={container}
			class="canvas-viewport bg-muted relative min-h-0 flex-1 overflow-hidden outline-none {cursorClass()}"
			style:cursor={toolCursor()}
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
						{#if preview.type === "rect" || preview.type === "text" || preview.type === "image"}
							<rect
								x={preview.x}
								y={preview.y}
								width={preview.width}
								height={preview.height}
								fill="var(--primary)"
								fill-opacity="0.12"
								stroke="var(--primary)"
								stroke-width="1"
								stroke-dasharray={preview.type === "image"
									? "10 6"
									: preview.type === "text"
										? "4 4"
										: undefined}
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
					{#if pathSession}
						{@const points = pathSession.points}
						{@const last = points[points.length - 1]}
						<polyline
							points={points.map((p) => `${p.x},${p.y}`).join(" ")}
							fill="none"
							stroke="var(--primary)"
							stroke-width="1"
							pointer-events="none"
						/>
						{#if points.length > 0}
							<line
								x1={last.x}
								y1={last.y}
								x2={pathSession.current.x}
								y2={pathSession.current.y}
								stroke="var(--primary)"
								stroke-width="1"
								stroke-dasharray="4 4"
								pointer-events="none"
							/>
						{/if}
						{#each points as point, index (index)}
							{@const isFirst = index === 0}
							{@const isLast = index === points.length - 1}
							{@const highlighted =
								(isFirst && pathSession.nearFirst) || (isLast && pathSession.nearLast)}
							{@const radius = highlighted ? pathPreviewRadius : pathVertexRadius}
							<circle
								cx={point.x}
								cy={point.y}
								r={radius}
								fill={highlighted ? "var(--primary)" : "var(--background)"}
								stroke="var(--primary)"
								stroke-width="1"
								pointer-events="none"
							/>
						{/each}
						{#if pathSession.nearFirst}
							{@const first = points[0]}
							<circle
								cx={first.x}
								cy={first.y}
								r={pathPreviewRadius}
								fill="var(--primary)"
								fill-opacity="0.2"
								stroke="var(--primary)"
								stroke-width="1"
								role="button"
								tabindex="-1"
								aria-label="Close path"
								onpointerdown={(event) => {
									event.preventDefault();
									event.stopPropagation();
									closePath();
								}}
							/>
						{/if}
					{/if}
				</svg>
			{/if}
			{#if selectedImage && containerWidth > 0 && containerHeight > 0}
				<ImageCropToolbar element={selectedImage} {cropEditing} {containerWidth} {containerHeight} />
			{/if}
		</div>
	</ContextMenu.Trigger>
	<ContextMenu.Content>
		{#if contextMenuTarget === "element"}
			<ContextMenu.Item onclick={handleCopy}>Copy</ContextMenu.Item>
			<ContextMenu.Separator />
			<ContextMenu.Item disabled={contextMenuElementIsFrontmost} onclick={handleBringToFront}>
				Bring to front
			</ContextMenu.Item>
			<ContextMenu.Item disabled={contextMenuElementIsFrontmost} onclick={handleBringForward}>
				Bring forward
			</ContextMenu.Item>
			<ContextMenu.Item disabled={contextMenuElementIsBackmost} onclick={handleSendBackward}>
				Send backward
			</ContextMenu.Item>
			<ContextMenu.Item disabled={contextMenuElementIsBackmost} onclick={handleSendToBack}>
				Send to back
			</ContextMenu.Item>
			<ContextMenu.Separator />
			<ContextMenu.Item variant="destructive" onclick={handleDelete}>Delete</ContextMenu.Item>
		{:else}
			<ContextMenu.Item disabled={!hasClipboardElement} onclick={handlePaste}>Paste</ContextMenu.Item>
		{/if}
	</ContextMenu.Content>
</ContextMenu.Root>
