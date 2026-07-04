<script lang="ts">
	import { App } from "@app";
	import type { PathElement } from "@app/types";

	interface Props {
		element: PathElement;
	}

	let { element }: Props = $props();
	const canvas = App.state.canvas;
	const SELECTION_COLOR = "#2563eb";

	const transform = $derived(App.geometry.pathRenderTransform(element));
	const strokeWidth = $derived(2.5 / $canvas.camera.zoom);
</script>

<path
	d={element.d}
	transform="translate({transform.x}, {transform.y})"
	fill="none"
	stroke={SELECTION_COLOR}
	stroke-width={strokeWidth}
	pointer-events="none"
/>
