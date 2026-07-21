<script lang="ts">
	import ColorPicker from "@components/core/ColorPicker.svelte";
	import { parseIntNumber, parseNonNegativeNumber, parsePositiveInt } from "@maply/model";
	import type { Element } from "@maply/model/types";
	import { Editor } from "editor";

	import PropertyField from "./PropertyField.svelte";
	import { getSharedElementProperties, type SharedElementProperty } from "./shared-properties";

	let { elements }: { elements: readonly Element[] } = $props();
	const canvas = Editor.state.canvas;
	const properties = $derived(getSharedElementProperties(elements));
	const numericProperties = $derived(properties.filter((property) => property !== "name" && property !== "fill"));
	const sharedName = $derived.by(() => {
		const first = elements[0];
		if (!first || elements.some((element) => element.name !== first.name)) return "";
		return first.name;
	});

	function label(property: SharedElementProperty) {
		switch (property) {
			case "name":
				return "Name";
			case "x":
				return "X";
			case "y":
				return "Y";
			case "width":
				return "Width";
			case "height":
				return "Height";
			case "centerX":
				return "Center X";
			case "centerY":
				return "Center Y";
			case "radius":
				return "Radius";
			case "fontSize":
				return "Font size";
			case "fill":
				return "Color";
		}
	}

	function value(element: Element, property: SharedElementProperty): number | string | null {
		switch (property) {
			case "name":
				return element.name;
			case "x":
				return element.type === "circle" ? null : element.x - $canvas.x;
			case "y":
				return element.type === "circle" ? null : element.y - $canvas.y;
			case "width":
				return "width" in element ? element.width : null;
			case "height":
				return "height" in element ? element.height : null;
			case "centerX":
				return element.type === "circle" ? element.cx - $canvas.x : null;
			case "centerY":
				return element.type === "circle" ? element.cy - $canvas.y : null;
			case "radius":
				return element.type === "circle" ? element.r : null;
			case "fontSize":
				return element.type === "text" ? element.fontSize : null;
			case "fill":
				return "fill" in element ? element.fill : null;
		}
	}

	function sharedValue(property: SharedElementProperty): number | string | "" {
		const first = elements[0];
		if (!first) return "";
		const firstValue = value(first, property);
		if (firstValue === null || elements.some((element) => value(element, property) !== firstValue)) return "";
		return firstValue;
	}

	function sharedFillValue(): string {
		const fill = sharedValue("fill");
		return typeof fill === "string" && fill.length > 0 ? fill : "#ffffff";
	}

	function update(property: Exclude<SharedElementProperty, "fill">, raw: string) {
		const parsed = property === "radius" ? parseNonNegativeNumber(raw) : parsePositiveInt(raw);
		const value =
			property === "x" || property === "y" || property === "centerX" || property === "centerY"
				? parseIntNumber(raw)
				: parsed;
		if (value === null) return;

		const patch =
			property === "x"
				? { x: $canvas.x + value }
				: property === "y"
					? { y: $canvas.y + value }
					: property === "centerX"
						? { cx: $canvas.x + value }
						: property === "centerY"
							? { cy: $canvas.y + value }
							: property === "radius"
								? { r: value }
								: { [property]: value };
		Editor.element.updateAll(
			elements.map((element) => element.id),
			patch
		);
	}

	function updateFill(fill: string) {
		Editor.fill.set(fill);
		Editor.element.updateAll(
			elements.map((element) => element.id),
			{ fill }
		);
	}

	function updateName(name: string) {
		const trimmedName = name.trim();
		if (!trimmedName) return false;

		Editor.element.updateAll(
			elements.map((element) => element.id),
			{ name: trimmedName }
		);
		return true;
	}
</script>

{#if properties.includes("name")}
	<PropertyField id="shared-name" label="Name" value={sharedName} type="text" onChange={updateName} />
{/if}
{#if numericProperties.length > 0}
	<div class="grid grid-cols-2 gap-2">
		{#each numericProperties as property (property)}
			<PropertyField
				id="shared-{property}"
				label={label(property)}
				value={sharedValue(property)}
				min={property === "radius" ? 0 : ["width", "height", "fontSize"].includes(property) ? 1 : undefined}
				step={1}
				onChange={(value) => update(property, value)}
			/>
		{/each}
	</div>
{/if}
{#if properties.includes("fill")}
	<ColorPicker
		id="shared-fill"
		label={sharedValue("fill") === "" ? "Color (mixed)" : "Color"}
		value={sharedFillValue()}
		onChange={updateFill}
	/>
{/if}
{#if properties.length === 0}
	<p class="text-muted-foreground text-xs">The selected elements have no shared editable properties.</p>
{/if}
