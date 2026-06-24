<script lang="ts">
	import { getElementBounds, getTextLayoutMetrics, getWrappedTextMetrics } from "$lib/app/core/element-actions";
	import type { Element } from "$lib/app/domain/elements";
	import { parseIntNumber, parseNonNegativeNumber, parsePositiveInt } from "$lib/app/domain/validation";
	import { projectState } from "$lib/app/state/project.svelte";
	import { Input } from "$lib/components/ui/input";
	import { Textarea } from "$lib/components/ui/textarea";

	import ColorPicker from "./ColorPicker.svelte";

	interface Props {
		element: Element;
	}

	let { element }: Props = $props();

	function updateNumber(key: string, value: string) {
		const parsed = parseIntNumber(value);
		if (parsed === null) return;
		projectState.updateElement(element.id, { [key]: parsed } as Partial<Element>);
	}

	function updatePositiveInt(key: string, value: string) {
		const parsed = parsePositiveInt(value);
		if (parsed === null) return;
		projectState.updateElement(element.id, { [key]: parsed } as Partial<Element>);
	}

	function updateNonNegativeNumber(key: string, value: string) {
		const parsed = parseNonNegativeNumber(value);
		if (parsed === null) return;
		projectState.updateElement(element.id, { [key]: parsed } as Partial<Element>);
	}

	function updateColor(key: "fill" | "stroke", value: string) {
		projectState.updateElement(element.id, { [key]: value } as Partial<Element>);
	}

	function updateText(value: string) {
		if (element.type === "text") {
			const currentBounds = getElementBounds(element);
			const { left, ascent } = getTextLayoutMetrics(value, element.fontSize, element.width);
			projectState.updateElement(element.id, {
				text: value,
				x: Math.round(currentBounds.x + left),
				y: Math.round(currentBounds.y + ascent)
			} as Partial<Element>);
			return;
		}

		projectState.updateElement(element.id, { text: value } as Partial<Element>);
	}

	function updatePath(value: string) {
		const closed = /\s*[Zz]\s*$/.test(value);
		const patch: Partial<Element> = { d: value, closed };
		if (closed) {
			patch.strokeWidth = 0;
		} else {
			patch.fill = "none";
		}
		projectState.updateElement(element.id, patch);
	}

	function updateHref(value: string) {
		projectState.updateElement(element.id, { href: value } as Partial<Element>);
	}

	function getTextVisualX() {
		if (element.type !== "text") return 0;
		return getElementBounds(element).x;
	}

	function getTextVisualY() {
		if (element.type !== "text") return 0;
		return getElementBounds(element).y;
	}

	function updateTextVisualX(value: string) {
		if (element.type !== "text") return;
		const parsed = parseIntNumber(value);
		if (parsed === null) return;
		const { left } = getWrappedTextMetrics(element);
		projectState.updateElement(element.id, {
			x: Math.round(parsed + left)
		} as Partial<Element>);
	}

	function updateTextVisualY(value: string) {
		if (element.type !== "text") return;
		const parsed = parseIntNumber(value);
		if (parsed === null) return;
		const { ascent } = getWrappedTextMetrics(element);
		projectState.updateElement(element.id, {
			y: Math.round(parsed + ascent)
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
			projectState.updateElement(element.id, { width: parsed } as Partial<Element>);
			return;
		}
		projectState.updateElement(element.id, {
			height: parsed
		} as Partial<Element>);
	}

	function updateTextFontSize(value: string) {
		if (element.type !== "text") return;
		const parsed = parsePositiveInt(value);
		if (parsed === null) return;
		const currentBounds = getElementBounds(element);
		const { left, ascent } = getTextLayoutMetrics(element.text, parsed, element.width);
		projectState.updateElement(element.id, {
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
				value={element.y}
				onchange={(event) => updateNumber("y", (event.target as HTMLInputElement).value)}
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
				value={element.cx}
				onchange={(event) => updateNumber("cx", (event.target as HTMLInputElement).value)}
				class="no-spinner h-7 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
			/>
		</div>
		<div class="flex flex-col gap-1">
			<label for="{element.id}-cy" class="text-sidebar-foreground/70 text-xs">Center Y</label>
			<Input
				id="{element.id}-cy"
				type="number"
				step={1}
				value={element.cy}
				onchange={(event) => updateNumber("cy", (event.target as HTMLInputElement).value)}
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
				value={element.x}
				onchange={(event) => updateNumber("x", (event.target as HTMLInputElement).value)}
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
				value={element.x}
				onchange={(event) => updateNumber("x", (event.target as HTMLInputElement).value)}
				class="no-spinner h-7 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
			/>
		</div>
		<div class="flex flex-col gap-1">
			<label for="{element.id}-y" class="text-sidebar-foreground/70 text-xs">Y</label>
			<Input
				id="{element.id}-y"
				type="number"
				step={1}
				value={element.y}
				onchange={(event) => updateNumber("y", (event.target as HTMLInputElement).value)}
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
				value={element.x}
				onchange={(event) => updateNumber("x", (event.target as HTMLInputElement).value)}
				class="no-spinner h-7 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
			/>
		</div>
		<div class="flex flex-col gap-1">
			<label for="{element.id}-y" class="text-sidebar-foreground/70 text-xs">Y</label>
			<Input
				id="{element.id}-y"
				type="number"
				step={1}
				value={element.y}
				onchange={(event) => updateNumber("y", (event.target as HTMLInputElement).value)}
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
	<div class="flex flex-col gap-1">
		<label for="{element.id}-href" class="text-sidebar-foreground/70 text-xs">Source URL</label>
		<Input
			id="{element.id}-href"
			type="text"
			value={element.href}
			onchange={(event) => updateHref((event.target as HTMLInputElement).value)}
			class="h-7 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
		/>
	</div>
{/if}
