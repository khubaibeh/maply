<script lang="ts">
	import { Textarea } from "$lib/components/ui/textarea";
	import ColorPicker from "@components/core/ColorPicker.svelte";
	import { parseIntNumber, parsePositiveInt } from "@maply/model";
	import type { TextElement } from "@maply/model/types";
	import { Editor } from "editor";

	import PropertyField from "./PropertyField.svelte";

	let { element }: { element: TextElement } = $props();
	const canvas = Editor.state.canvas;

	function updateVisualPosition(axis: "x" | "y", value: string) {
		const parsed = parseIntNumber(value);
		if (parsed === null) return;
		const metrics = Editor.text.wrappedMetrics(element);
		Editor.element.update(element.id, {
			[axis]: Math.round((axis === "x" ? $canvas.x + metrics.left : $canvas.y + metrics.ascent) + parsed)
		});
	}

	function updateDimension(axis: "width" | "height", value: string) {
		const parsed = parsePositiveInt(value);
		if (parsed !== null) Editor.element.update(element.id, { [axis]: parsed });
	}

	function updateText(text: string) {
		if (text === element.text) return;
		const bounds = Editor.geometry.elementBounds(element);
		const { left, ascent } = Editor.text.layoutMetrics(text, element.fontSize, element.width);
		Editor.element.update(element.id, {
			text,
			x: Math.round(bounds.x + left),
			y: Math.round(bounds.y + ascent)
		});
	}

	function updateFontSize(value: string) {
		const fontSize = parsePositiveInt(value);
		if (fontSize === null) return;
		const bounds = Editor.geometry.elementBounds(element);
		const { left, ascent } = Editor.text.layoutMetrics(element.text, fontSize, element.width);
		Editor.element.update(element.id, {
			fontSize,
			x: Math.round(bounds.x + left),
			y: Math.round(bounds.y + ascent)
		});
	}

	function commit(event: Event) {
		updateText((event.currentTarget as HTMLTextAreaElement).value);
	}
</script>

<div class="grid grid-cols-2 gap-2">
	<PropertyField
		id="{element.id}-x"
		label="X"
		value={Editor.geometry.elementBounds(element).x - $canvas.x}
		step={1}
		onChange={(v) => updateVisualPosition("x", v)}
	/>
	<PropertyField
		id="{element.id}-y"
		label="Y"
		value={Editor.geometry.elementBounds(element).y - $canvas.y}
		step={1}
		onChange={(v) => updateVisualPosition("y", v)}
	/>
	<PropertyField
		id="{element.id}-width"
		label="Width"
		value={element.width}
		min={1}
		step={1}
		onChange={(v) => updateDimension("width", v)}
	/>
	<PropertyField
		id="{element.id}-height"
		label="Height"
		value={element.height}
		min={1}
		step={1}
		onChange={(v) => updateDimension("height", v)}
	/>
	<PropertyField
		id="{element.id}-fontSize"
		label="Font size"
		value={element.fontSize}
		min={1}
		step={1}
		onChange={updateFontSize}
	/>
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
<div class="flex flex-col gap-1">
	<label for="{element.id}-text" class="text-sidebar-foreground/70 text-xs">Text</label>
	<Textarea
		id="{element.id}-text"
		value={element.text}
		onblur={commit}
		onkeydown={(event) => {
			if (event.key !== "Enter" || event.shiftKey) return;
			event.preventDefault();
			commit(event);
			(event.currentTarget as HTMLTextAreaElement).blur();
		}}
		rows={3}
		class="min-h-24 resize-y text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
	/>
</div>
