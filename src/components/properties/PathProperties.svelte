<script lang="ts">
	import { Textarea } from "$lib/components/ui/textarea";
	import ColorPicker from "@components/core/ColorPicker.svelte";
	import { parseIntNumber, parseNonNegativeNumber } from "@maply/model";
	import type { PathElement } from "@maply/model/types";
	import { Editor } from "editor";

	import PropertyField from "./PropertyField.svelte";

	let { element }: { element: PathElement } = $props();
	const canvas = Editor.state.canvas;
	const fill = Editor.state.fill;

	function updatePosition(key: "x" | "y", value: string) {
		const parsed = parseIntNumber(value);
		if (parsed === null) return;
		Editor.element.update(element.id, { [key]: (key === "x" ? $canvas.x : $canvas.y) + parsed });
	}

	function updatePath(d: string) {
		const closed = /\s*[Zz]\s*$/.test(d);
		Editor.element.update(
			element.id,
			closed
				? { d, closed, strokeWidth: 0, fill: !element.closed && element.fill === "none" ? $fill : element.fill }
				: { d, closed, fill: "none" }
		);
	}
</script>

<div class="grid grid-cols-2 gap-2">
	<PropertyField
		id="{element.id}-x"
		label="X"
		value={element.x - $canvas.x}
		step={1}
		onChange={(v) => updatePosition("x", v)}
	/>
	<PropertyField
		id="{element.id}-y"
		label="Y"
		value={element.y - $canvas.y}
		step={1}
		onChange={(v) => updatePosition("y", v)}
	/>
</div>
<div class="flex flex-col gap-1">
	<label for="{element.id}-d" class="text-sidebar-foreground/70 text-xs">Path</label>
	<Textarea
		id="{element.id}-d"
		value={element.d}
		onchange={(event) => updatePath((event.currentTarget as HTMLTextAreaElement).value)}
		rows={4}
		class="font-mono text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
	/>
</div>
{#if element.closed}
	<ColorPicker
		id="{element.id}-fill"
		label="Fill"
		value={element.fill}
		onChange={(fill) => {
			Editor.fill.set(fill);
			Editor.element.update(element.id, { fill });
		}}
	/>
{:else}
	<div class="grid grid-cols-2 gap-2">
		<ColorPicker
			id="{element.id}-stroke"
			label="Stroke"
			value={element.stroke}
			onChange={(stroke) => Editor.element.update(element.id, { stroke })}
		/>
		<PropertyField
			id="{element.id}-strokeWidth"
			label="Stroke width"
			value={element.strokeWidth}
			min={0}
			step={1}
			onChange={(value) => {
				const strokeWidth = parseNonNegativeNumber(value);
				if (strokeWidth !== null) Editor.element.update(element.id, { strokeWidth });
			}}
		/>
	</div>
{/if}
