<script lang="ts">
	import type { RectElement } from "@maply/model/types";

	let { element }: { element: RectElement } = $props();
</script>

<rect
	x={element.x}
	y={element.y}
	width={element.width}
	height={element.height}
	fill={element.fill}
	stroke={element.stroke}
	stroke-width={element.strokeWidth}
/>
