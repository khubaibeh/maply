<script lang="ts">
	import { getPathRenderTransform } from "$lib/app/core/element-actions";
	import { App } from "@app";
	import type { PathElement } from "@app/types";

	interface Props {
		element: PathElement;
	}

	let { element }: Props = $props();
	const canvas = App.state.canvas;

	const transform = $derived(getPathRenderTransform(element));
	const strokeWidth = $derived(1.25 / $canvas.camera.zoom);
</script>

<path
	d={element.d}
	transform="translate({transform.x}, {transform.y})"
	fill="none"
	stroke="var(--primary)"
	stroke-width={strokeWidth}
	pointer-events="none"
/>
