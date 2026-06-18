<script lang="ts">
	import { Input } from "$lib/components/ui/input";
	import { Textarea } from "$lib/components/ui/textarea";
	import type { Element } from "$lib/editor/model/elements";
	import {
		parseHexColor,
		parseIntNumber,
		parseNonNegativeNumber,
		parsePositiveInt
	} from "$lib/editor/model/validation";
	import { projectState } from "$lib/editor/state/project.svelte";

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
		const color = parseHexColor(value);
		if (color === null) return;
		projectState.updateElement(element.id, { [key]: color } as Partial<Element>);
	}

	function updateText(value: string) {
		projectState.updateElement(element.id, { text: value } as Partial<Element>);
	}

	function updatePath(value: string) {
		projectState.updateElement(element.id, { d: value } as Partial<Element>);
	}

	function updateHref(value: string) {
		projectState.updateElement(element.id, { href: value } as Partial<Element>);
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
				value={element.x}
				oninput={(event) => updateNumber("x", (event.target as HTMLInputElement).value)}
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
				oninput={(event) => updateNumber("y", (event.target as HTMLInputElement).value)}
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
				oninput={(event) => updatePositiveInt("width", (event.target as HTMLInputElement).value)}
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
				oninput={(event) => updatePositiveInt("height", (event.target as HTMLInputElement).value)}
				class="no-spinner h-7 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
			/>
		</div>
	</div>
	<div class="flex flex-col gap-1">
		<label for="{element.id}-fill" class="text-sidebar-foreground/70 text-xs">Color</label>
		<Input
			id="{element.id}-fill"
			type="text"
			value={element.fill}
			oninput={(event) => updateColor("fill", (event.target as HTMLInputElement).value)}
			class="h-7 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
		/>
	</div>
{:else if element.type === "circle"}
	<div class="grid grid-cols-2 gap-2">
		<div class="flex flex-col gap-1">
			<label for="{element.id}-cx" class="text-sidebar-foreground/70 text-xs">Center X</label>
			<Input
				id="{element.id}-cx"
				type="number"
				step={1}
				value={element.cx}
				oninput={(event) => updateNumber("cx", (event.target as HTMLInputElement).value)}
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
				oninput={(event) => updateNumber("cy", (event.target as HTMLInputElement).value)}
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
				oninput={(event) => updateNonNegativeNumber("r", (event.target as HTMLInputElement).value)}
				class="no-spinner h-7 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
			/>
		</div>
		<div class="flex flex-col gap-1">
			<label for="{element.id}-fill" class="text-sidebar-foreground/70 text-xs">Color</label>
			<Input
				id="{element.id}-fill"
				type="text"
				value={element.fill}
				oninput={(event) => updateColor("fill", (event.target as HTMLInputElement).value)}
				class="h-7 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
			/>
		</div>
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
				oninput={(event) => updateNumber("x", (event.target as HTMLInputElement).value)}
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
				oninput={(event) => updateNumber("y", (event.target as HTMLInputElement).value)}
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
				oninput={(event) => updatePositiveInt("fontSize", (event.target as HTMLInputElement).value)}
				class="no-spinner h-7 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
			/>
		</div>
		<div class="flex flex-col gap-1">
			<label for="{element.id}-fill" class="text-sidebar-foreground/70 text-xs">Color</label>
			<Input
				id="{element.id}-fill"
				type="text"
				value={element.fill}
				oninput={(event) => updateColor("fill", (event.target as HTMLInputElement).value)}
				class="h-7 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
			/>
		</div>
	</div>
	<div class="flex flex-col gap-1">
		<label for="{element.id}-text" class="text-sidebar-foreground/70 text-xs">Text</label>
		<Textarea
			id="{element.id}-text"
			value={element.text}
			oninput={(event) => updateText((event.target as HTMLTextAreaElement).value)}
			rows={3}
			class="text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
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
				oninput={(event) => updateNumber("x", (event.target as HTMLInputElement).value)}
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
				oninput={(event) => updateNumber("y", (event.target as HTMLInputElement).value)}
				class="no-spinner h-7 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
			/>
		</div>
	</div>
	<div class="flex flex-col gap-1">
		<label for="{element.id}-d" class="text-sidebar-foreground/70 text-xs">Path</label>
		<Textarea
			id="{element.id}-d"
			value={element.d}
			oninput={(event) => updatePath((event.target as HTMLTextAreaElement).value)}
			rows={4}
			class="font-mono text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
		/>
	</div>
	<div class="grid grid-cols-2 gap-2">
		<div class="flex flex-col gap-1">
			<label for="{element.id}-fill" class="text-sidebar-foreground/70 text-xs">Fill</label>
			<Input
				id="{element.id}-fill"
				type="text"
				value={element.fill}
				oninput={(event) => updateColor("fill", (event.target as HTMLInputElement).value)}
				class="h-7 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
			/>
		</div>
		<div class="flex flex-col gap-1">
			<label for="{element.id}-stroke" class="text-sidebar-foreground/70 text-xs">Stroke</label>
			<Input
				id="{element.id}-stroke"
				type="text"
				value={element.stroke}
				oninput={(event) => updateColor("stroke", (event.target as HTMLInputElement).value)}
				class="h-7 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
			/>
		</div>
		<div class="flex flex-col gap-1">
			<label for="{element.id}-strokeWidth" class="text-sidebar-foreground/70 text-xs">Stroke width</label>
			<Input
				id="{element.id}-strokeWidth"
				type="number"
				min={0}
				step={1}
				value={element.strokeWidth}
				oninput={(event) => updateNonNegativeNumber("strokeWidth", (event.target as HTMLInputElement).value)}
				class="no-spinner h-7 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
			/>
		</div>
	</div>
{:else if element.type === "image"}
	<div class="grid grid-cols-2 gap-2">
		<div class="flex flex-col gap-1">
			<label for="{element.id}-x" class="text-sidebar-foreground/70 text-xs">X</label>
			<Input
				id="{element.id}-x"
				type="number"
				step={1}
				value={element.x}
				oninput={(event) => updateNumber("x", (event.target as HTMLInputElement).value)}
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
				oninput={(event) => updateNumber("y", (event.target as HTMLInputElement).value)}
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
				oninput={(event) => updatePositiveInt("width", (event.target as HTMLInputElement).value)}
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
				oninput={(event) => updatePositiveInt("height", (event.target as HTMLInputElement).value)}
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
			oninput={(event) => updateHref((event.target as HTMLInputElement).value)}
			class="h-7 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
		/>
	</div>
{/if}
