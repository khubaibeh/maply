<script lang="ts">
	import ColorPicker from "@components/core/ColorPicker.svelte";
	import { parseIntNumber, parseNonNegativeNumber } from "@maply/model";
	import type { CircleElement } from "@maply/model/types";
	import { Editor } from "editor";

	import PropertyField from "./PropertyField.svelte";

	let { element }: { element: CircleElement } = $props();
	const canvas = Editor.state.canvas;

	function updateCenter(key: "cx" | "cy", value: string) {
		const parsed = parseIntNumber(value);
		if (parsed === null) return;
		Editor.element.update(element.id, { [key]: (key === "cx" ? $canvas.x : $canvas.y) + parsed });
	}

	function updateRadius(value: string) {
		const r = parseNonNegativeNumber(value);
		if (r !== null) Editor.element.update(element.id, { r });
	}
</script>

<div class="grid grid-cols-2 gap-2">
	<PropertyField
		id="{element.id}-cx"
		label="Center X"
		value={element.cx - $canvas.x}
		step={1}
		onChange={(v) => updateCenter("cx", v)}
	/>
	<PropertyField
		id="{element.id}-cy"
		label="Center Y"
		value={element.cy - $canvas.y}
		step={1}
		onChange={(v) => updateCenter("cy", v)}
	/>
	<PropertyField id="{element.id}-r" label="Radius" value={element.r} min={0} step={1} onChange={updateRadius} />
	<ColorPicker
		id="{element.id}-fill"
		label="Color"
		value={element.fill}
		onChange={(fill) => {
			Editor.fill.set(fill);
			Editor.element.update(element.id, { fill });
		}}
	/>
</div>
