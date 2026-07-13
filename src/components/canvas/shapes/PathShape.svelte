<script lang="ts">
	import type { PathElement } from "@maply/model/types";

	let { element, x, y }: { element: PathElement; x: number; y: number } = $props();
</script>

<path
	transform="translate({x}, {y})"
	d={element.d}
	fill={element.fill}
	stroke={element.stroke}
	stroke-width={element.strokeWidth}
/>
