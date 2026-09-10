<script lang="ts">
	import type { Element } from "@maply/model/types";
	import { Editor } from "editor";

	let { elements }: { elements: readonly Element[] } = $props();
	const canvas = Editor.state.canvas;
	const bounds = $derived.by(() => {
		const first = elements[0];
		if (!first) return null;
		const firstBounds = Editor.document.bounds(first.id) ?? Editor.geometry.elementBounds(first);
		let left = firstBounds.x;
		let top = firstBounds.y;
		let right = firstBounds.x + firstBounds.width;
		let bottom = firstBounds.y + firstBounds.height;

		for (const element of elements.slice(1)) {
			const next = Editor.document.bounds(element.id) ?? Editor.geometry.elementBounds(element);
			left = Math.min(left, next.x);
			top = Math.min(top, next.y);
			right = Math.max(right, next.x + next.width);
			bottom = Math.max(bottom, next.y + next.height);
		}

		return { x: left, y: top, width: right - left, height: bottom - top };
	});
	const padding = $derived(4 / $canvas.camera.zoom);
	const strokeWidth = $derived(2 / $canvas.camera.zoom);
	const cornerRadius = $derived(2 / $canvas.camera.zoom);
	const dash = $derived(`${6 / $canvas.camera.zoom} ${4 / $canvas.camera.zoom}`);
	const frame = $derived(
		bounds
			? {
					x: bounds.x - padding,
					y: bounds.y - padding,
					width: bounds.width + padding * 2,
					height: bounds.height + padding * 2
				}
			: null
	);
</script>

{#if frame}
	<rect
		x={frame.x}
		y={frame.y}
		width={frame.width}
		height={frame.height}
		rx={cornerRadius}
		fill="none"
		stroke="var(--canvas-selection)"
		stroke-width={strokeWidth}
		stroke-dasharray={dash}
		pointer-events="none"
	/>
{/if}
