<script lang="ts">
	import type { PathElement } from "@maply/model/types";
	import { Editor } from "editor";

	interface Props {
		element: PathElement;
	}

	let { element }: Props = $props();
	const canvas = Editor.state.canvas;

	const transform = $derived(Editor.geometry.pathRenderTransform(element));
	const strokeWidth = $derived(2.5 / $canvas.camera.zoom);
</script>

<path
	d={element.d}
	transform="translate({transform.x}, {transform.y})"
	fill="none"
	stroke="var(--canvas-selection)"
	stroke-width={strokeWidth}
	pointer-events="none"
/>
