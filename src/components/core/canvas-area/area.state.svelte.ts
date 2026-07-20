import { clientToSvgPoint } from "@components/canvas/interaction/svg";
import { canvasCursor } from "@components/core/cursors";
import { isPointInsideCanvas } from "@maply/model";
import type { ImageElement, Point } from "@maply/model/types";
import { Editor } from "editor";
import { onMount } from "svelte";
import { fromStore } from "svelte/store";

import { panFromDrag, zoomAt } from "./camera";
import { createCanvasContextMenu } from "./context-menu.svelte";
import { isDrawingTool } from "./drawing";
import { createDrawingSession } from "./drawing-session.svelte";
import { createPathSession } from "./path-session.svelte";

const VERTEX_DOT_SCREEN_PX = 3;
const CLOSE_HANDLE_SCREEN_PX = 6;

/** Composes canvas interaction modules and owns viewport browser-resource lifetimes. */
export function createCanvasAreaState() {
	const canvas = fromStore(Editor.state.canvas);
	const project = fromStore(Editor.state.project);
	const tool = fromStore(Editor.state.tool);
	const contextMenu = createCanvasContextMenu();
	const drawing = createDrawingSession();
	const path = createPathSession();

	const state = $state({
		container: null as HTMLDivElement | null,
		svgRef: null as SVGSVGElement | null,
		containerWidth: 0,
		containerHeight: 0,
		isPanning: false,
		isHovering: false,
		panStart: { x: 0, y: 0 },
		cameraStart: { x: 0, y: 0, zoom: 1 }
	});

	const selectedImage = $derived(
		(project.current.selectedElementIds.length === 1
			? (project.current.elements.find(
					(element) => element.id === project.current.selectedElementId && element.type === "image"
				) ?? null)
			: null) as ImageElement | null
	);
	const cropEditing = $derived(
		project.current.cropEditingElementId === project.current.selectedElementId && selectedImage !== null
	);

	$effect(() => {
		if (tool.current.activeTool !== "path" && path.state.session) path.cancel();
	});

	const isHandActive = $derived(
		tool.current.activeTool === "hand" || (state.isHovering && tool.current.isSpacePressed)
	);
	const cursorClass = $derived.by(() => {
		if (state.isPanning) return canvasCursor.allScroll;
		if (isHandActive) return canvasCursor.hand;
		return canvasCursor.default;
	});

	const toolCursor = $derived.by(() => {
		if (state.isPanning || isHandActive) return undefined;

		const activeTool = tool.current.activeTool;
		if (activeTool === "rect" || activeTool === "circle" || activeTool === "image") {
			return canvasCursor.plus;
		}
		if (activeTool === "text") return canvasCursor.text;
		if (activeTool === "path") return canvasCursor.pen;
		return undefined;
	});

	const pathPreviewRadius = $derived(CLOSE_HANDLE_SCREEN_PX / canvas.current.camera.zoom);
	const pathVertexRadius = $derived(VERTEX_DOT_SCREEN_PX / canvas.current.camera.zoom);
	const viewBox = $derived(
		`${canvas.current.camera.x} ${canvas.current.camera.y} ${state.containerWidth / canvas.current.camera.zoom} ${state.containerHeight / canvas.current.camera.zoom}`
	);

	onMount(() => {
		if (!state.container) return;
		const viewport = state.container;

		const resizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const rect = entry.contentRect;
				state.containerWidth = rect.width;
				state.containerHeight = rect.height;
			}
		});

		resizeObserver.observe(state.container);

		const initialRect = state.container.getBoundingClientRect();
		state.containerWidth = initialRect.width;
		state.containerHeight = initialRect.height;

		function handleWheel(event: WheelEvent) {
			const cropEditingElement = project.current.cropEditingElementId
				? project.current.elements.find((element) => element.id === project.current.cropEditingElementId)
				: null;

			if (cropEditingElement?.type === "image") {
				const point = projectPoint(event.clientX, event.clientY);
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
				const zoomSensitivity = 0.0025;
				const nextZoom = Math.min(
					Editor.limits.zoom.max,
					Math.max(
						Editor.limits.zoom.min,
						canvas.current.camera.zoom * Math.exp(-event.deltaY * zoomSensitivity)
					)
				);
				if (nextZoom === canvas.current.camera.zoom) return;

				const rect = viewport.getBoundingClientRect();
				Editor.actions.canvas.setCamera(
					zoomAt(
						canvas.current.camera,
						{ x: event.clientX - rect.left, y: event.clientY - rect.top },
						nextZoom
					)
				);
			} else {
				Editor.actions.canvas.pan(
					event.deltaX / canvas.current.camera.zoom,
					event.deltaY / canvas.current.camera.zoom
				);
			}
		}

		function startPan(event: MouseEvent) {
			const canPan = event.button === 1 || (event.button === 0 && isHandActive);
			if (!canPan) return;

			event.preventDefault();
			viewport.focus();
			state.isPanning = true;
			state.panStart = { x: event.clientX, y: event.clientY };
			state.cameraStart = { ...canvas.current.camera };
		}

		function movePan(event: MouseEvent) {
			if (!state.isPanning) return;
			Editor.actions.canvas.setCamera(
				panFromDrag(state.cameraStart, state.panStart, {
					x: event.clientX,
					y: event.clientY
				})
			);
		}

		function endPan() {
			state.isPanning = false;
		}

		function moveDrawing(event: PointerEvent) {
			if (!drawing.state.session) return;
			const point = projectPoint(event.clientX, event.clientY);
			if (point) drawing.move(point, event.shiftKey);
		}

		function movePathDrawing(event: PointerEvent) {
			if (!path.state.session) return;
			const point = projectPoint(event.clientX, event.clientY);
			if (point) path.move(point, event.shiftKey);
		}

		function endDrawing(event: PointerEvent) {
			if (!drawing.state.session) return;
			event.preventDefault();
			drawing.end(projectPoint(event.clientX, event.clientY), event.shiftKey);
		}

		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === "Escape" && drawing.state.session) {
				event.preventDefault();
				drawing.cancel();
				return;
			}

			if (event.key === "Escape" && path.state.session) {
				event.preventDefault();
				path.cancel();
				return;
			}

			if (event.key === "Enter" && path.state.session) {
				event.preventDefault();
				path.close();
				return;
			}

			if (event.key !== " ") return;
			if (!state.isHovering) return;
			event.preventDefault();
			Editor.actions.tool.setSpacePressed(true);
		}

		function handleKeyUp(event: KeyboardEvent) {
			if (event.key !== " ") return;
			event.preventDefault();
			Editor.actions.tool.setSpacePressed(false);
		}

		function handleMouseEnter() {
			state.isHovering = true;
		}

		function handleMouseLeave() {
			state.isHovering = false;
			Editor.actions.tool.setSpacePressed(false);
		}

		viewport.addEventListener("wheel", handleWheel, { passive: false });
		viewport.addEventListener("mousedown", startPan);
		viewport.addEventListener("mouseenter", handleMouseEnter);
		viewport.addEventListener("mouseleave", handleMouseLeave);
		window.addEventListener("mousemove", movePan);
		window.addEventListener("mouseup", endPan);
		window.addEventListener("pointermove", moveDrawing);
		window.addEventListener("pointermove", movePathDrawing);
		window.addEventListener("pointerup", endDrawing);
		window.addEventListener("pointercancel", drawing.cancel);
		window.addEventListener("pointerdown", contextMenu.dismiss, true);
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
			window.removeEventListener("pointercancel", drawing.cancel);
			window.removeEventListener("pointerdown", contextMenu.dismiss, true);
			window.removeEventListener("keydown", handleKeyDown);
			window.removeEventListener("keyup", handleKeyUp);
		};
	});

	function projectPoint(clientX: number, clientY: number): Point | null {
		return state.svgRef ? clientToSvgPoint(state.svgRef, clientX, clientY) : null;
	}

	function handleSvgPointerDown(event: PointerEvent) {
		if (event.button !== 0) return;
		if (isHandActive) return;
		if (tool.current.activeTool === "select") {
			Editor.selection.select(null);
			return;
		}

		const drawPoint = projectPoint(event.clientX, event.clientY);
		if (!drawPoint) return;
		const insideArtboard = isPointInsideCanvas(drawPoint, {
			x: canvas.current.x,
			y: canvas.current.y,
			width: canvas.current.width,
			height: canvas.current.height,
			color: canvas.current.color
		});

		if (!insideArtboard) {
			if (tool.current.activeTool === "path" && path.state.session) {
				event.preventDefault();
				event.stopPropagation();
				path.cancel();
			}
			return;
		}

		event.preventDefault();
		event.stopPropagation();

		if (tool.current.activeTool === "path") {
			path.add(drawPoint, event.shiftKey);
			return;
		}

		if (!isDrawingTool(tool.current.activeTool)) return;

		drawing.start(tool.current.activeTool, drawPoint, event.shiftKey);
	}

	function handleContextMenu(event: MouseEvent) {
		contextMenu.handle(event, projectPoint(event.clientX, event.clientY));
	}

	return {
		state,
		contextMenu,
		path,
		selectedImage: () => selectedImage,
		cropEditing: () => cropEditing,
		camera: () => canvas.current.camera,
		cursorClass: () => cursorClass,
		toolCursor: () => toolCursor,
		shapePreview: drawing.preview,
		pathPreviewRadius: () => pathPreviewRadius,
		pathVertexRadius: () => pathVertexRadius,
		viewBox: () => viewBox,
		closePath: path.close,
		handleSvgPointerDown,
		handleContextMenu
	};
}
