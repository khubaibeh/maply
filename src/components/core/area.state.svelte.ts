import { canvasCursor } from "@components/core/cursors";
import { isPointInsideCanvas } from "@maply/model";
import type { ImageElement, Point } from "@maply/model/types";
import { Editor } from "editor";
import { onMount } from "svelte";
import { fromStore } from "svelte/store";

type DrawingTool = "rect" | "circle" | "text" | "image";

type DrawingSession = {
	tool: DrawingTool;
	start: Point;
	current: Point;
	square: boolean;
};

type PathSession = {
	points: Point[];
	current: Point;
	nearFirst: boolean;
};

const CLOSE_THRESHOLD_SCREEN_PX = 12;
const VERTEX_DOT_SCREEN_PX = 3;
const CLOSE_HANDLE_SCREEN_PX = 6;

export function createCanvasAreaState() {
	const canvas = fromStore(Editor.state.canvas);
	const project = fromStore(Editor.state.project);
	const tool = fromStore(Editor.state.tool);

	const state = $state({
		container: null as HTMLDivElement | null,
		svgRef: null as SVGSVGElement | null,
		contextMenuOpen: false,
		contextMenuTarget: "empty" as "element" | "empty",
		contextMenuElementId: null as string | null,
		contextMenuPoint: null as Point | null,
		containerWidth: 0,
		containerHeight: 0,
		isPanning: false,
		isHovering: false,
		panStart: { x: 0, y: 0 },
		cameraStart: { x: 0, y: 0 },
		drawingSession: null as DrawingSession | null,
		pathSession: null as PathSession | null
	});

	const hasClipboardElement = $derived(Editor.clipboard.get().length > 0);
	const contextMenuElementLayerIndex = $derived(
		state.contextMenuElementId
			? project.current.elements.findIndex((element) => element.id === state.contextMenuElementId)
			: -1
	);
	const contextMenuElementIsFrontmost = $derived(
		contextMenuElementLayerIndex === project.current.elements.length - 1
	);
	const contextMenuElementIsBackmost = $derived(contextMenuElementLayerIndex === 0);
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
		if (tool.current.activeTool !== "path" && state.pathSession) {
			state.pathSession = null;
		}
	});

	const isHandActive = $derived(
		tool.current.activeTool === "hand" || (state.isHovering && tool.current.isSpacePressed)
	);
	const cursorClass = $derived.by(() => {
		if (state.isPanning) return canvasCursor.grabbing;
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

	const shapePreview = $derived.by(() => {
		if (!state.drawingSession) return null;
		const box = Editor.geometry.shapeDragBox(
			state.drawingSession.start,
			state.drawingSession.current,
			state.drawingSession.tool === "rect" && state.drawingSession.square
		);
		if (!box) return null;

		if (
			state.drawingSession.tool === "rect" ||
			state.drawingSession.tool === "text" ||
			state.drawingSession.tool === "image"
		) {
			return { type: state.drawingSession.tool, ...box };
		}

		const diameter = Math.min(box.width, box.height);
		return {
			type: "circle" as const,
			cx: box.x + diameter / 2,
			cy: box.y + diameter / 2,
			r: diameter / 2
		};
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
				const mouseX = event.clientX - rect.left;
				const mouseY = event.clientY - rect.top;

				const worldX = canvas.current.camera.x + mouseX / canvas.current.camera.zoom;
				const worldY = canvas.current.camera.y + mouseY / canvas.current.camera.zoom;

				Editor.actions.canvas.setCamera({
					zoom: nextZoom,
					x: worldX - mouseX / nextZoom,
					y: worldY - mouseY / nextZoom
				});
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
			state.cameraStart = { x: canvas.current.camera.x, y: canvas.current.camera.y };
		}

		function movePan(event: MouseEvent) {
			if (!state.isPanning) return;
			const dx = (state.panStart.x - event.clientX) / canvas.current.camera.zoom;
			const dy = (state.panStart.y - event.clientY) / canvas.current.camera.zoom;
			Editor.actions.canvas.setCamera({
				x: state.cameraStart.x + dx,
				y: state.cameraStart.y + dy
			});
		}

		function endPan() {
			state.isPanning = false;
		}

		function moveDrawing(event: PointerEvent) {
			if (!state.drawingSession) return;
			const point = clientToSvgPoint(event.clientX, event.clientY);
			if (!point) return;
			state.drawingSession = {
				...state.drawingSession,
				current: clampPointToCanvas(point),
				square: event.shiftKey
			};
		}

		function movePathDrawing(event: PointerEvent) {
			if (!state.pathSession) return;
			const point = clientToSvgPoint(event.clientX, event.clientY);
			if (!point) return;
			updatePathSessionCurrent(point, event.shiftKey);
		}

		function endDrawing(event: PointerEvent) {
			if (!state.drawingSession) return;
			event.preventDefault();
			const session = state.drawingSession;
			const endPoint = clientToSvgPoint(event.clientX, event.clientY);
			const end = endPoint ? clampPointToCanvas(endPoint) : session.current;
			state.drawingSession = null;

			let element = null;
			if (session.tool === "rect") {
				element = Editor.create.rectFromDrag(session.start, end, project.current.elements, event.shiftKey);
			} else if (session.tool === "circle") {
				element = Editor.create.circleFromDrag(session.start, end, project.current.elements);
			} else if (session.tool === "text") {
				element = Editor.create.textFromDrag(session.start, end, project.current.elements);
			} else if (session.tool === "image") {
				element = Editor.create.imageFromDrag(session.start, end, project.current.elements);
			}
			if (!element) return;

			Editor.element.add(element);
			Editor.actions.tool.set("select");
		}

		function cancelDrawing() {
			state.drawingSession = null;
		}

		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === "Escape" && state.drawingSession) {
				event.preventDefault();
				cancelDrawing();
				return;
			}

			if (event.key === "Escape" && state.pathSession) {
				event.preventDefault();
				cancelPath();
				return;
			}

			if (event.key === "Enter" && state.pathSession) {
				event.preventDefault();
				closePath();
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

		function dismissContextMenu(event: PointerEvent) {
			if (event.button !== 0 || !state.contextMenuOpen) return;
			if (event.target instanceof Element && event.target.closest('[data-slot="context-menu-content"]')) return;
			state.contextMenuOpen = false;
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

	function distance(a: Point, b: Point): number {
		const dx = a.x - b.x;
		const dy = a.y - b.y;
		return Math.sqrt(dx * dx + dy * dy);
	}

	function clampPointToCanvas(point: Point): Point {
		return {
			x: Math.max(canvas.current.x, Math.min(canvas.current.x + canvas.current.width, point.x)),
			y: Math.max(canvas.current.y, Math.min(canvas.current.y + canvas.current.height, point.y))
		};
	}

	function clientToSvgPoint(clientX: number, clientY: number): Point | null {
		if (!state.svgRef) return null;
		const ctm = state.svgRef.getScreenCTM();
		if (!ctm) return null;

		const point = state.svgRef.createSVGPoint();
		point.x = clientX;
		point.y = clientY;
		const svgPoint = point.matrixTransform(ctm.inverse());
		return { x: svgPoint.x, y: svgPoint.y };
	}

	function updatePathSessionCurrent(point: Point, shiftKey = false) {
		if (!state.pathSession) return;
		const clampedPoint = clampPointToCanvas(point);
		const last = state.pathSession.points[state.pathSession.points.length - 1];
		const snappedPoint = shiftKey && last ? Editor.geometry.snapPathSegment(last, clampedPoint) : clampedPoint;
		const current = last ? clampPointToCanvasAlongSegment(last, snappedPoint) : snappedPoint;
		const first = state.pathSession.points[0];
		const threshold = CLOSE_THRESHOLD_SCREEN_PX / canvas.current.camera.zoom;
		const nearFirst = first ? distance(first, current) <= threshold : false;
		state.pathSession = {
			...state.pathSession,
			current,
			nearFirst
		};
	}

	function clampPointToCanvasAlongSegment(start: Point, point: Point): Point {
		if (point.x >= canvas.current.x && point.x <= canvas.current.x + canvas.current.width) {
			if (point.y >= canvas.current.y && point.y <= canvas.current.y + canvas.current.height) {
				return point;
			}
		}

		const dx = point.x - start.x;
		const dy = point.y - start.y;
		let maxT = 1;

		if (dx > 0) {
			maxT = Math.min(maxT, (canvas.current.x + canvas.current.width - start.x) / dx);
		} else if (dx < 0) {
			maxT = Math.min(maxT, (canvas.current.x - start.x) / dx);
		}

		if (dy > 0) {
			maxT = Math.min(maxT, (canvas.current.y + canvas.current.height - start.y) / dy);
		} else if (dy < 0) {
			maxT = Math.min(maxT, (canvas.current.y - start.y) / dy);
		}

		const t = Math.max(0, maxT);
		return {
			x: start.x + dx * t,
			y: start.y + dy * t
		};
	}

	function commitPath() {
		if (!state.pathSession) return;
		const points = state.pathSession.points;
		state.pathSession = null;

		const element = Editor.create.pathFromPoints(points, true, project.current.elements);
		if (!element) return;

		Editor.element.add(element);
		Editor.actions.tool.set("select");
	}

	function closePath() {
		if (!state.pathSession || state.pathSession.points.length < 3) return;
		commitPath();
	}

	function cancelPath() {
		state.pathSession = null;
	}

	function isShapeDrawingTool(tool: string): tool is DrawingTool {
		return tool === "rect" || tool === "circle" || tool === "text" || tool === "image";
	}

	function handleSvgPointerDown(event: PointerEvent) {
		if (event.button !== 0) return;
		if (isHandActive) return;
		if (tool.current.activeTool === "select") {
			Editor.selection.select(null);
			return;
		}

		const drawPoint = clientToSvgPoint(event.clientX, event.clientY);
		if (!drawPoint) return;
		const insideArtboard = isPointInsideCanvas(drawPoint, {
			x: canvas.current.x,
			y: canvas.current.y,
			width: canvas.current.width,
			height: canvas.current.height,
			color: canvas.current.color
		});

		if (!insideArtboard) {
			if (tool.current.activeTool === "path" && state.pathSession) {
				event.preventDefault();
				event.stopPropagation();
				cancelPath();
			}
			return;
		}

		event.preventDefault();
		event.stopPropagation();

		if (tool.current.activeTool === "path") {
			if (state.pathSession) {
				updatePathSessionCurrent(drawPoint, event.shiftKey);
				if (!state.pathSession) return;

				if (state.pathSession.nearFirst) {
					closePath();
				} else {
					state.pathSession = {
						...state.pathSession,
						points: [...state.pathSession.points, state.pathSession.current]
					};
					updatePathSessionCurrent(drawPoint, event.shiftKey);
				}
			} else {
				state.pathSession = {
					points: [drawPoint],
					current: drawPoint,
					nearFirst: false
				};
			}
			return;
		}

		if (!isShapeDrawingTool(tool.current.activeTool)) return;

		state.drawingSession = {
			tool: tool.current.activeTool,
			start: drawPoint,
			current: drawPoint,
			square: event.shiftKey
		};
	}

	function handleContextMenu(event: MouseEvent) {
		state.contextMenuPoint = clientToSvgPoint(event.clientX, event.clientY);
		const target = event.target as Element | null;
		const elementNode = target?.closest("[data-canvas-element]");
		if (elementNode instanceof Element) {
			const id = elementNode.getAttribute("data-canvas-element");
			if (id) {
				if (!project.current.selectedElementIds.includes(id)) {
					Editor.selection.select(id);
				}
				state.contextMenuTarget = "element";
				state.contextMenuElementId = id;
				return;
			}
		}
		if (project.current.selectedElementIds.length > 0) {
			Editor.selection.select(null);
		}
		state.contextMenuTarget = "empty";
		state.contextMenuElementId = null;
	}

	function handleCopy() {
		if (!state.contextMenuElementId) return;
		const elements = project.current.selectedElementIds.includes(state.contextMenuElementId)
			? project.current.elements.filter((entry) => project.current.selectedElementIds.includes(entry.id))
			: project.current.elements.filter((entry) => entry.id === state.contextMenuElementId);
		if (elements.length > 0) Editor.clipboard.copy(elements);
		state.contextMenuOpen = false;
	}

	function handleDelete() {
		if (!state.contextMenuElementId) return;
		const ids = project.current.selectedElementIds.includes(state.contextMenuElementId)
			? project.current.selectedElementIds
			: [state.contextMenuElementId];
		void Editor.element.delete(ids);
		state.contextMenuOpen = false;
	}

	function handleBringToFront() {
		if (!state.contextMenuElementId) return;
		if (project.current.selectedElementIds.length > 1) return;
		Editor.element.moveToFront(state.contextMenuElementId);
		state.contextMenuOpen = false;
	}

	function handleBringForward() {
		if (!state.contextMenuElementId) return;
		if (project.current.selectedElementIds.length > 1) return;
		Editor.element.moveForward(state.contextMenuElementId);
		state.contextMenuOpen = false;
	}

	function handleSendBackward() {
		if (!state.contextMenuElementId) return;
		if (project.current.selectedElementIds.length > 1) return;
		Editor.element.moveBackward(state.contextMenuElementId);
		state.contextMenuOpen = false;
	}

	function handleSendToBack() {
		if (!state.contextMenuElementId) return;
		if (project.current.selectedElementIds.length > 1) return;
		Editor.element.moveToBack(state.contextMenuElementId);
		state.contextMenuOpen = false;
	}

	function handlePaste() {
		const copied = Editor.clipboard.get();
		if (copied.length === 0) return;
		void Editor.clipboard.paste(state.contextMenuPoint ?? undefined);
		state.contextMenuOpen = false;
	}

	function handleSelectAll() {
		Editor.selection.selectAll();
		state.contextMenuOpen = false;
	}

	return {
		state,
		hasClipboardElement: () => hasClipboardElement,
		contextMenuElementIsFrontmost: () => contextMenuElementIsFrontmost,
		contextMenuElementIsBackmost: () => contextMenuElementIsBackmost,
		selectedImage: () => selectedImage,
		cropEditing: () => cropEditing,
		camera: () => canvas.current.camera,
		cursorClass: () => cursorClass,
		toolCursor: () => toolCursor,
		shapePreview: () => shapePreview,
		pathPreviewRadius: () => pathPreviewRadius,
		pathVertexRadius: () => pathVertexRadius,
		viewBox: () => viewBox,
		closePath,
		handleSvgPointerDown,
		handleContextMenu,
		handleCopy,
		handleDelete,
		handleBringToFront,
		handleBringForward,
		handleSendBackward,
		handleSendToBack,
		handlePaste,
		handleSelectAll
	};
}
