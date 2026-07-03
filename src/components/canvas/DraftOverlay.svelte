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

	const SELECTION_COLOR = "#2563eb";
</script>

{#if shapePreview}
	{#if shapePreview.type === "circle"}
		<circle
			cx={shapePreview.cx}
			cy={shapePreview.cy}
			r={shapePreview.r}
			fill={SELECTION_COLOR}
			fill-opacity="0.12"
			stroke={SELECTION_COLOR}
			stroke-width="1"
			pointer-events="none"
		/>
	{:else}
		<rect
			x={shapePreview.x}
			y={shapePreview.y}
			width={shapePreview.width}
			height={shapePreview.height}
			fill={SELECTION_COLOR}
			fill-opacity="0.12"
			stroke={SELECTION_COLOR}
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
		stroke={SELECTION_COLOR}
		stroke-width="1"
		pointer-events="none"
	/>
	{#if points.length > 0}
		<line
			x1={last.x}
			y1={last.y}
			x2={pathSession.current.x}
			y2={pathSession.current.y}
			stroke={SELECTION_COLOR}
			stroke-width="1"
			stroke-dasharray="4 4"
			pointer-events="none"
		/>
	{/if}
	{#each points as point, index (index)}
		{@const isFirst = index === 0}
		{@const highlighted = isFirst && pathSession.nearFirst}
		{@const radius = highlighted ? pathPreviewRadius : pathVertexRadius}
		<circle
			cx={point.x}
			cy={point.y}
			r={radius}
			fill={highlighted ? SELECTION_COLOR : "white"}
			stroke={SELECTION_COLOR}
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
			fill={SELECTION_COLOR}
			fill-opacity="0.2"
			stroke={SELECTION_COLOR}
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
