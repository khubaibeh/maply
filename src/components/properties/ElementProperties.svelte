<script lang="ts">
	import type { Element } from "@maply/model/types";

	import CircleProperties from "./CircleProperties.svelte";
	import ImageProperties from "./ImageProperties.svelte";
	import PathProperties from "./PathProperties.svelte";
	import RectProperties from "./RectProperties.svelte";
	import TextProperties from "./TextProperties.svelte";

	let { element }: { element: Element } = $props();
</script>

{#if element.type === "rect"}
	<RectProperties {element} />
{:else if element.type === "circle"}
	<CircleProperties {element} />
{:else if element.type === "text"}
	<TextProperties {element} />
{:else if element.type === "path"}
	<PathProperties {element} />
{:else if element.type === "image"}
	<ImageProperties {element} />
{/if}
