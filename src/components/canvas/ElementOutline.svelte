<script lang="ts">
	import { resizeAnchors } from "@components/canvas/interaction/handles";
	import { createPointerDrag } from "@components/canvas/interaction/pointer-drag.svelte";
	import { clientToSvgPoint, getSvgRoot, toSvgPoint } from "@components/canvas/interaction/svg";
	import { resizeCursor } from "@components/core/cursors";
	import type { Element } from "@maply/model/types";
	import { Editor } from "editor";
	import type { ResizeHandle } from "editor/types";

	type Props = {
		element: Element;
		interactive?: boolean;
		onMoveStart?: (event: PointerEvent, id: string) => void;
	};

	let { element, interactive = true, onMoveStart }: Props = $props();
	const canvas = Editor.state.canvas;
	const project = Editor.state.project;
	const tool = Editor.state.tool;
	const hideOutline = $derived(element.type === "image" && $project.cropEditingElementId === element.id);
	const canResize = $derived(
		interactive &&
			!hideOutline &&
			$tool.activeTool === "select" &&
			$project.selectedElementIds.length === 1 &&
			$project.selectedElementId === element.id &&
			(element.type === "rect" ||
				element.type === "text" ||
				element.type === "image" ||
				element.type === "circle")
	);

	let bbox = $state({ x: 0, y: 0, width: 0, height: 0 });

	const strokeWidth = $derived(2.5 / $canvas.camera.zoom);
	const handleStrokeWidth = $derived(2 / $canvas.camera.zoom);
	const handleSize = $derived(10 / $canvas.camera.zoom);
	const handleRadius = $derived(1 / $canvas.camera.zoom);
	const handles = $derived(resizeAnchors(bbox));
	const resize = createPointerDrag();

	$effect(() => {
		if (element.type === "text" || element.type === "image") {
			const padding = 0.5;
			const bounds = Editor.geometry.elementBounds(element);
			bbox = {
				x: bounds.x - padding,
				y: bounds.y - padding,
				width: bounds.width + padding * 2,
				height: bounds.height + padding * 2
			};
			return;
		}

		if (typeof document === "undefined") return;
		const node = document.getElementById(`element-${element.id}`);
		if (!(node instanceof SVGGraphicsElement)) return;
		const svg = node.ownerSVGElement;
		const elementMatrix = node.getScreenCTM();
		const svgMatrix = svg?.getScreenCTM();
		if (!svg || !elementMatrix || !svgMatrix) return;

		const rect = node.getBBox();
		const matrix = svgMatrix.inverse().multiply(elementMatrix);
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

	function startResize(event: PointerEvent, handle: ResizeHandle) {
		if (event.button !== 0 || !canResize) return;
		event.preventDefault();
		event.stopPropagation();

		const svg = getSvgRoot(event.target);
		if (!svg) return;
		const bounds = Editor.geometry.elementBounds(element);
		const lockAspectRatio = event.shiftKey;
		const aspectRatio = bounds.height > 0 ? bounds.width / bounds.height : undefined;
		resize.start(event, {
			project: (pointerEvent) => clientToSvgPoint(svg, pointerEvent.clientX, pointerEvent.clientY),
			onMove: ({ delta }) => {
				Editor.element.resize(element.id, handle, delta.x, delta.y, {
					lockAspectRatio,
					aspectRatio
				});
			}
		});
	}
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
	stroke={hideOutline ? "transparent" : "var(--canvas-selection)"}
	pointer-events={interactive && !hideOutline ? "all" : "none"}
	style:cursor="inherit"
	onpointerdown={(event) => onMoveStart?.(event, element.id)}
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
			rx={handleRadius}
			fill="var(--canvas-handle-fill)"
			stroke="var(--canvas-selection)"
			stroke-width={handleStrokeWidth}
			style:cursor={resizeCursor(handle.key)}
			onpointerdown={(event) => startResize(event, handle.key)}
		/>
	{/each}
{/if}
