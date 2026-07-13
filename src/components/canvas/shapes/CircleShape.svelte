<script lang="ts">
	import type { CircleElement } from "@maply/model/types";

	let { element }: { element: CircleElement } = $props();
</script>

<circle
	cx={element.cx}
	cy={element.cy}
	r={element.r}
	fill={element.fill}
	stroke={element.stroke}
	stroke-width={element.strokeWidth}
/>
