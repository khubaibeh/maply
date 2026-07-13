<script lang="ts">
	import type { ImageElement } from "@maply/model/types";

	type Props = {
		element: ImageElement;
		href: string;
		renderRect: { x: number; y: number; width: number; height: number } | null;
	};

	let { element, href, renderRect }: Props = $props();
</script>

<rect x={element.x} y={element.y} width={element.width} height={element.height} fill="var(--muted)" />
{#if href}
	<svg
		x={element.x}
		y={element.y}
		width={element.width}
		height={element.height}
		viewBox={`0 0 ${element.width} ${element.height}`}
		overflow="hidden"
		pointer-events="none"
	>
		{#if renderRect}
			<image
				x={renderRect.x}
				y={renderRect.y}
				width={renderRect.width}
				height={renderRect.height}
				{href}
				preserveAspectRatio="none"
			/>
		{:else}
			<image
				x="0"
				y="0"
				width={element.width}
				height={element.height}
				{href}
				preserveAspectRatio="xMidYMid slice"
			/>
		{/if}
	</svg>
{:else}
	<path
		d="M0 0h18l5 6h13v18H0z"
		fill="none"
		stroke="var(--muted-foreground)"
		stroke-width="1.5"
		transform="translate({element.x + element.width / 2 - 18}, {element.y + element.height / 2 - 16})"
		pointer-events="none"
	/>
	<line
		x1={element.x + 14}
		y1={element.y + element.height - 14}
		x2={element.x + element.width - 14}
		y2={element.y + 14}
		stroke="var(--muted-foreground)"
		stroke-opacity="0.35"
		stroke-width="2"
		stroke-linecap="round"
		pointer-events="none"
	/>
{/if}
