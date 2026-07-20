<script lang="ts">
	import type { TextElement } from "@maply/model/types";

	type Props = {
		element: TextElement;
		lines: string[];
		lineHeight: number;
		metrics: { left: number; ascent: number };
	};

	let { element, lines, lineHeight, metrics }: Props = $props();
</script>

<defs>
	<clipPath id="text-clip-{element.id}">
		<rect
			x={element.x - metrics.left}
			y={element.y - metrics.ascent}
			width={element.width}
			height={element.height}
		/>
	</clipPath>
</defs>
<text
	x={element.x}
	y={element.y}
	font-size={element.fontSize}
	font-family="Inter Variable, sans-serif"
	fill={element.fill}
	xml:space="preserve"
	clip-path="url(#text-clip-{element.id})"
	class="select-none"
>
	{#each lines as line, index (index)}
		<tspan x={element.x} dy={index === 0 ? 0 : `${lineHeight}px`}>{line || " "}</tspan>
	{/each}
</text>
