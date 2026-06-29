<script lang="ts">
	type CanvasPoint = {
		x: number;
		y: number;
	};

	type ShapePreview =
		| {
				type: "rect" | "text" | "image";
				x: number;
				y: number;
				width: number;
				height: number;
		  }
		| {
				type: "circle";
				cx: number;
				cy: number;
				r: number;
		  };

	type PathSession = {
		points: CanvasPoint[];
		current: CanvasPoint;
		nearFirst: boolean;
		nearLast: boolean;
	};

	let {
		shapePreview,
		pathSession,
		pathPreviewRadius,
		pathVertexRadius,
		onClosePath
	}: {
		shapePreview: ShapePreview | null;
		pathSession: PathSession | null;
		pathPreviewRadius: number;
		pathVertexRadius: number;
		onClosePath: () => void;
	} = $props();
</script>

{#if shapePreview}
	{#if shapePreview.type === "circle"}
		<circle
			cx={shapePreview.cx}
			cy={shapePreview.cy}
			r={shapePreview.r}
			fill="var(--primary)"
			fill-opacity="0.12"
			stroke="var(--primary)"
			stroke-width="1"
			pointer-events="none"
		/>
	{:else}
		<rect
			x={shapePreview.x}
			y={shapePreview.y}
			width={shapePreview.width}
			height={shapePreview.height}
			fill="var(--primary)"
			fill-opacity="0.12"
			stroke="var(--primary)"
			stroke-width="1"
			stroke-dasharray={shapePreview.type === "image" ? "10 6" : shapePreview.type === "text" ? "4 4" : undefined}
			pointer-events="none"
		/>
	{/if}
{/if}

{#if pathSession}
	{@const points = pathSession.points}
	{@const last = points[points.length - 1]}
	<polyline
		points={points.map((point) => `${point.x},${point.y}`).join(" ")}
		fill="none"
		stroke="var(--primary)"
		stroke-width="1"
		pointer-events="none"
	/>
	{#if points.length > 0}
		<line
			x1={last.x}
			y1={last.y}
			x2={pathSession.current.x}
			y2={pathSession.current.y}
			stroke="var(--primary)"
			stroke-width="1"
			stroke-dasharray="4 4"
			pointer-events="none"
		/>
	{/if}
	{#each points as point, index (index)}
		{@const isFirst = index === 0}
		{@const isLast = index === points.length - 1}
		{@const highlighted = (isFirst && pathSession.nearFirst) || (isLast && pathSession.nearLast)}
		{@const radius = highlighted ? pathPreviewRadius : pathVertexRadius}
		<circle
			cx={point.x}
			cy={point.y}
			r={radius}
			fill={highlighted ? "var(--primary)" : "var(--background)"}
			stroke="var(--primary)"
			stroke-width="1"
			pointer-events="none"
		/>
	{/each}
	{#if pathSession.nearFirst}
		{@const first = points[0]}
		<circle
			cx={first.x}
			cy={first.y}
			r={pathPreviewRadius}
			fill="var(--primary)"
			fill-opacity="0.2"
			stroke="var(--primary)"
			stroke-width="1"
			role="button"
			tabindex="-1"
			aria-label="Close path"
			onpointerdown={(event) => {
				event.preventDefault();
				event.stopPropagation();
				onClosePath();
			}}
		/>
	{/if}
{/if}
