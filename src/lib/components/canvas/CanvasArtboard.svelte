<script lang="ts">
	import { canvasState } from "$lib/state/canvas.svelte";
</script>

<defs>
	<filter id="canvas-shadow" x="-10%" y="-10%" width="120%" height="120%">
		<feDropShadow dx="0" dy="1" stdDeviation="3" flood-color="black" flood-opacity="0.08" />
	</filter>
</defs>

<rect
	x={canvasState.x}
	y={canvasState.y}
	width={canvasState.width}
	height={canvasState.height}
	fill="#ffffff"
	stroke="var(--border)"
	filter="url(#canvas-shadow)"
/>
