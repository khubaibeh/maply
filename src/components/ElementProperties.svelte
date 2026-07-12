<script lang="ts">
	import { Input } from "$lib/components/ui/input";
	import { Textarea } from "$lib/components/ui/textarea";
	import ColorPicker from "@components/core/ColorPicker.svelte";
	import { parseIntNumber, parseNonNegativeNumber, parsePositiveInt } from "@maply/model";
	import type { Element } from "@maply/model/types";
	import { Editor } from "editor";

	interface Props {
		element: Element;
	}

	let { element }: Props = $props();
	const canvas = Editor.state.canvas;
	const fill = Editor.state.fill;

	function updateCanvasX(key: "x" | "cx", value: string) {
		const parsed = parseIntNumber(value);
		if (parsed === null) return;
		Editor.element.update(element.id, { [key]: $canvas.x + parsed } as Partial<Element>);
	}

	function updateCanvasY(key: "y" | "cy", value: string) {
		const parsed = parseIntNumber(value);
		if (parsed === null) return;
		Editor.element.update(element.id, { [key]: $canvas.y + parsed } as Partial<Element>);
	}

	function updatePositiveInt(key: string, value: string) {
		const parsed = parsePositiveInt(value);
		if (parsed === null) return;
		Editor.element.update(element.id, { [key]: parsed } as Partial<Element>);
	}

	function updateNonNegativeNumber(key: string, value: string) {
		const parsed = parseNonNegativeNumber(value);
		if (parsed === null) return;
		Editor.element.update(element.id, { [key]: parsed } as Partial<Element>);
	}

	function updateColor(key: "fill" | "stroke", value: string) {
		if (key === "fill") {
			Editor.fill.set(value);
		}
		Editor.element.update(element.id, { [key]: value } as Partial<Element>);
	}

	function updateText(value: string) {
		if (element.type === "text") {
			const currentBounds = Editor.geometry.elementBounds(element);
			const { left, ascent } = Editor.text.layoutMetrics(value, element.fontSize, element.width);
			Editor.element.update(element.id, {
				text: value,
				x: Math.round(currentBounds.x + left),
				y: Math.round(currentBounds.y + ascent)
			} as Partial<Element>);
			return;
		}

		Editor.element.update(element.id, { text: value } as Partial<Element>);
	}

	function updatePath(value: string) {
		if (element.type !== "path") return;
		const closed = /\s*[Zz]\s*$/.test(value);
		const patch: Partial<Element> = closed
			? {
					d: value,
					closed,
					strokeWidth: 0,
					fill: !element.closed && element.fill === "none" ? $fill : element.fill
				}
			: { d: value, closed, fill: "none" };
		Editor.element.update(element.id, patch);
	}

	function getTextVisualX() {
		if (element.type !== "text") return 0;
		return Editor.geometry.elementBounds(element).x - $canvas.x;
	}

	function getTextVisualY() {
		if (element.type !== "text") return 0;
		return Editor.geometry.elementBounds(element).y - $canvas.y;
	}

	function updateTextVisualX(value: string) {
		if (element.type !== "text") return;
		const parsed = parseIntNumber(value);
		if (parsed === null) return;
		const { left } = Editor.text.wrappedMetrics(element);
		Editor.element.update(element.id, {
			x: Math.round($canvas.x + parsed + left)
		} as Partial<Element>);
	}

	function updateTextVisualY(value: string) {
		if (element.type !== "text") return;
		const parsed = parseIntNumber(value);
		if (parsed === null) return;
		const { ascent } = Editor.text.wrappedMetrics(element);
		Editor.element.update(element.id, {
			y: Math.round($canvas.y + parsed + ascent)
		} as Partial<Element>);
	}

	function getTextWidth() {
		if (element.type !== "text") return 1;
		return element.width;
	}

	function getTextHeight() {
		if (element.type !== "text") return 1;
		return element.height;
	}

	function updateTextDimension(axis: "width" | "height", value: string) {
		if (element.type !== "text") return;
		const parsed = parsePositiveInt(value);
		if (parsed === null) return;

		if (axis === "width") {
			Editor.element.update(element.id, { width: parsed } as Partial<Element>);
			return;
		}
		Editor.element.update(element.id, {
			height: parsed
		} as Partial<Element>);
	}

	function updateTextFontSize(value: string) {
		if (element.type !== "text") return;
		const parsed = parsePositiveInt(value);
		if (parsed === null) return;
		const currentBounds = Editor.geometry.elementBounds(element);
		const { left, ascent } = Editor.text.layoutMetrics(element.text, parsed, element.width);
		Editor.element.update(element.id, {
			fontSize: parsed,
			x: Math.round(currentBounds.x + left),
			y: Math.round(currentBounds.y + ascent)
		} as Partial<Element>);
	}

	function commitTextDraft(event: Event) {
		if (element.type !== "text") return;
		const value = (event.currentTarget as HTMLTextAreaElement).value;
		if (value === element.text) return;
		updateText(value);
	}

	function handleTextKeydown(event: KeyboardEvent) {
		if (event.key !== "Enter" || event.shiftKey) return;
		event.preventDefault();
		commitTextDraft(event);
		(event.currentTarget as HTMLTextAreaElement).blur();
	}
</script>

{#if element.type === "rect"}
	<div class="grid grid-cols-2 gap-2">
		<div class="flex flex-col gap-1">
			<label for="{element.id}-x" class="text-sidebar-foreground/70 text-xs">X</label>
			<Input
				id="{element.id}-x"
				type="number"
				step={1}
				value={element.x - $canvas.x}
				onchange={(event) => updateCanvasX("x", (event.target as HTMLInputElement).value)}
				class="no-spinner h-7 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
			/>
		</div>
		<div class="flex flex-col gap-1">
			<label for="{element.id}-y" class="text-sidebar-foreground/70 text-xs">Y</label>
			<Input
				id="{element.id}-y"
				type="number"
				step={1}
				value={element.y - $canvas.y}
				onchange={(event) => updateCanvasY("y", (event.target as HTMLInputElement).value)}
				class="no-spinner h-7 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
			/>
		</div>
		<div class="flex flex-col gap-1">
			<label for="{element.id}-width" class="text-sidebar-foreground/70 text-xs">Width</label>
			<Input
				id="{element.id}-width"
				type="number"
				min={1}
				step={1}
				value={element.width}
				onchange={(event) => updatePositiveInt("width", (event.target as HTMLInputElement).value)}
				class="no-spinner h-7 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
			/>
		</div>
		<div class="flex flex-col gap-1">
			<label for="{element.id}-height" class="text-sidebar-foreground/70 text-xs">Height</label>
			<Input
				id="{element.id}-height"
				type="number"
				min={1}
				step={1}
				value={element.height}
				onchange={(event) => updatePositiveInt("height", (event.target as HTMLInputElement).value)}
				class="no-spinner h-7 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
			/>
		</div>
	</div>
	<ColorPicker
		id="{element.id}-fill"
		label="Color"
		value={element.fill}
		onChange={(color) => updateColor("fill", color)}
	/>
{:else if element.type === "circle"}
	<div class="grid grid-cols-2 gap-2">
		<div class="flex flex-col gap-1">
			<label for="{element.id}-cx" class="text-sidebar-foreground/70 text-xs">Center X</label>
			<Input
				id="{element.id}-cx"
				type="number"
				step={1}
				value={element.cx - $canvas.x}
				onchange={(event) => updateCanvasX("cx", (event.target as HTMLInputElement).value)}
				class="no-spinner h-7 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
			/>
		</div>
		<div class="flex flex-col gap-1">
			<label for="{element.id}-cy" class="text-sidebar-foreground/70 text-xs">Center Y</label>
			<Input
				id="{element.id}-cy"
				type="number"
				step={1}
				value={element.cy - $canvas.y}
				onchange={(event) => updateCanvasY("cy", (event.target as HTMLInputElement).value)}
				class="no-spinner h-7 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
			/>
		</div>
		<div class="flex flex-col gap-1">
			<label for="{element.id}-r" class="text-sidebar-foreground/70 text-xs">Radius</label>
			<Input
				id="{element.id}-r"
				type="number"
				min={0}
				step={1}
				value={element.r}
				onchange={(event) => updateNonNegativeNumber("r", (event.target as HTMLInputElement).value)}
				class="no-spinner h-7 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
			/>
		</div>
		<ColorPicker
			id="{element.id}-fill"
			label="Color"
			value={element.fill}
			onChange={(color) => updateColor("fill", color)}
		/>
	</div>
{:else if element.type === "text"}
	<div class="grid grid-cols-2 gap-2">
		<div class="flex flex-col gap-1">
			<label for="{element.id}-x" class="text-sidebar-foreground/70 text-xs">X</label>
			<Input
				id="{element.id}-x"
				type="number"
				step={1}
				value={getTextVisualX()}
				onchange={(event) => updateTextVisualX((event.target as HTMLInputElement).value)}
				class="no-spinner h-7 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
			/>
		</div>
		<div class="flex flex-col gap-1">
			<label for="{element.id}-y" class="text-sidebar-foreground/70 text-xs">Y</label>
			<Input
				id="{element.id}-y"
				type="number"
				step={1}
				value={getTextVisualY()}
				onchange={(event) => updateTextVisualY((event.target as HTMLInputElement).value)}
				class="no-spinner h-7 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
			/>
		</div>

		<div class="flex flex-col gap-1">
			<label for="{element.id}-width" class="text-sidebar-foreground/70 text-xs">Width</label>
			<Input
				id="{element.id}-width"
				type="number"
				min={1}
				step={1}
				value={getTextWidth()}
				onchange={(event) => updateTextDimension("width", (event.target as HTMLInputElement).value)}
				class="no-spinner h-7 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
			/>
		</div>
		<div class="flex flex-col gap-1">
			<label for="{element.id}-height" class="text-sidebar-foreground/70 text-xs">Height</label>
			<Input
				id="{element.id}-height"
				type="number"
				min={1}
				step={1}
				value={getTextHeight()}
				onchange={(event) => updateTextDimension("height", (event.target as HTMLInputElement).value)}
				class="no-spinner h-7 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
			/>
		</div>
		<div class="flex flex-col gap-1">
			<label for="{element.id}-fontSize" class="text-sidebar-foreground/70 text-xs">Font size</label>
			<Input
				id="{element.id}-fontSize"
				type="number"
				min={1}
				step={1}
				value={element.fontSize}
				onchange={(event) => updateTextFontSize((event.target as HTMLInputElement).value)}
				class="no-spinner h-7 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
			/>
		</div>
		<ColorPicker
			id="{element.id}-fill"
			label="Color"
			value={element.fill}
			onChange={(color) => updateColor("fill", color)}
		/>
	</div>
	<div class="flex flex-col gap-1">
		<label for="{element.id}-text" class="text-sidebar-foreground/70 text-xs">Text</label>
		<Textarea
			id="{element.id}-text"
			value={element.text}
			onblur={commitTextDraft}
			onkeydown={handleTextKeydown}
			rows={3}
			class="min-h-24 resize-y text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
		/>
	</div>
{:else if element.type === "path"}
	<div class="grid grid-cols-2 gap-2">
		<div class="flex flex-col gap-1">
			<label for="{element.id}-x" class="text-sidebar-foreground/70 text-xs">X</label>
			<Input
				id="{element.id}-x"
				type="number"
				step={1}
				value={element.x - $canvas.x}
				onchange={(event) => updateCanvasX("x", (event.target as HTMLInputElement).value)}
				class="no-spinner h-7 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
			/>
		</div>
		<div class="flex flex-col gap-1">
			<label for="{element.id}-y" class="text-sidebar-foreground/70 text-xs">Y</label>
			<Input
				id="{element.id}-y"
				type="number"
				step={1}
				value={element.y - $canvas.y}
				onchange={(event) => updateCanvasY("y", (event.target as HTMLInputElement).value)}
				class="no-spinner h-7 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
			/>
		</div>
	</div>
	<div class="flex flex-col gap-1">
		<label for="{element.id}-d" class="text-sidebar-foreground/70 text-xs">Path</label>
		<Textarea
			id="{element.id}-d"
			value={element.d}
			onchange={(event) => updatePath((event.target as HTMLTextAreaElement).value)}
			rows={4}
			class="font-mono text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
		/>
	</div>
	{#if element.closed}
		<ColorPicker
			id="{element.id}-fill"
			label="Fill"
			value={element.fill}
			onChange={(color) => updateColor("fill", color)}
		/>
	{:else}
		<div class="grid grid-cols-2 gap-2">
			<ColorPicker
				id="{element.id}-stroke"
				label="Stroke"
				value={element.stroke}
				onChange={(color) => updateColor("stroke", color)}
			/>
			<div class="flex flex-col gap-1">
				<label for="{element.id}-strokeWidth" class="text-sidebar-foreground/70 text-xs">Stroke width</label>
				<Input
					id="{element.id}-strokeWidth"
					type="number"
					min={0}
					step={1}
					value={element.strokeWidth}
					onchange={(event) =>
						updateNonNegativeNumber("strokeWidth", (event.target as HTMLInputElement).value)}
					class="no-spinner h-7 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
				/>
			</div>
		</div>
	{/if}
{:else if element.type === "image"}
	<div class="grid grid-cols-2 gap-2">
		<div class="flex flex-col gap-1">
			<label for="{element.id}-x" class="text-sidebar-foreground/70 text-xs">X</label>
			<Input
				id="{element.id}-x"
				type="number"
				step={1}
				value={element.x - $canvas.x}
				onchange={(event) => updateCanvasX("x", (event.target as HTMLInputElement).value)}
				class="no-spinner h-7 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
			/>
		</div>
		<div class="flex flex-col gap-1">
			<label for="{element.id}-y" class="text-sidebar-foreground/70 text-xs">Y</label>
			<Input
				id="{element.id}-y"
				type="number"
				step={1}
				value={element.y - $canvas.y}
				onchange={(event) => updateCanvasY("y", (event.target as HTMLInputElement).value)}
				class="no-spinner h-7 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
			/>
		</div>
		<div class="flex flex-col gap-1">
			<label for="{element.id}-width" class="text-sidebar-foreground/70 text-xs">Width</label>
			<Input
				id="{element.id}-width"
				type="number"
				min={1}
				step={1}
				value={element.width}
				onchange={(event) => updatePositiveInt("width", (event.target as HTMLInputElement).value)}
				class="no-spinner h-7 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
			/>
		</div>
		<div class="flex flex-col gap-1">
			<label for="{element.id}-height" class="text-sidebar-foreground/70 text-xs">Height</label>
			<Input
				id="{element.id}-height"
				type="number"
				min={1}
				step={1}
				value={element.height}
				onchange={(event) => updatePositiveInt("height", (event.target as HTMLInputElement).value)}
				class="no-spinner h-7 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
			/>
		</div>
	</div>
{/if}
