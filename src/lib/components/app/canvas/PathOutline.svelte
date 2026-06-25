<script lang="ts">
	import { getPathRenderTransform } from "$lib/app/core/element-actions";
	import type { PathElement } from "$lib/app/domain/elements";
	import { canvasState } from "$lib/app/state/canvas.svelte";

	interface Props {
		element: PathElement;
	}

	let { element }: Props = $props();

	const transform = $derived(getPathRenderTransform(element));
	const strokeWidth = $derived(1.25 / $canvasState.camera.zoom);
</script>

<path
	d={element.d}
	transform="translate({transform.x}, {transform.y})"
	fill="none"
	stroke="var(--primary)"
	stroke-width={strokeWidth}
	pointer-events="none"
/>
