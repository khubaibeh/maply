<script lang="ts">
	import ColorPicker from "@components/core/ColorPicker.svelte";
	import { parseIntNumber, parsePositiveInt } from "@maply/model";
	import type { RectElement } from "@maply/model/types";
	import { Editor } from "editor";

	import PropertyField from "./PropertyField.svelte";

	let { element }: { element: RectElement } = $props();
	const canvas = Editor.state.canvas;

	function updatePosition(key: "x" | "y", value: string) {
		const parsed = parseIntNumber(value);
		if (parsed === null) return;
		Editor.element.update(element.id, { [key]: (key === "x" ? $canvas.x : $canvas.y) + parsed });
	}

	function updateSize(key: "width" | "height", value: string) {
		const parsed = parsePositiveInt(value);
		if (parsed !== null) Editor.element.update(element.id, { [key]: parsed });
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
	<PropertyField
		id="{element.id}-width"
		label="Width"
		value={element.width}
		min={1}
		step={1}
		onChange={(v) => updateSize("width", v)}
	/>
	<PropertyField
		id="{element.id}-height"
		label="Height"
		value={element.height}
		min={1}
		step={1}
		onChange={(v) => updateSize("height", v)}
	/>
</div>
<ColorPicker
	id="{element.id}-fill"
	label="Color"
	value={element.fill}
	onChange={(fill) => {
		Editor.fill.set(fill);
		Editor.element.update(element.id, { fill });
	}}
/>
