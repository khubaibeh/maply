<script lang="ts">
	interface Props {
		elementId: string;
	}

	let { elementId }: Props = $props();

	let bbox = $state({ x: 0, y: 0, width: 0, height: 0 });

	$effect(() => {
		if (typeof document === "undefined") return;
		const el = document.getElementById(`element-${elementId}`);
		if (!(el instanceof SVGGraphicsElement)) return;
		const rect = el.getBBox();
		const padding = 2;
		bbox = {
			x: rect.x - padding,
			y: rect.y - padding,
			width: rect.width + padding * 2,
			height: rect.height + padding * 2
		};
	});
</script>

<rect
	x={bbox.x}
	y={bbox.y}
	width={bbox.width}
	height={bbox.height}
	fill="none"
	stroke="var(--primary)"
	stroke-width="1"
	stroke-dasharray="4 2"
	pointer-events="none"
/>
