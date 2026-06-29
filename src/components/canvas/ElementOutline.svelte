<script lang="ts">
	import Outline from "$lib/components/app/canvas/Outline.svelte";
	import type { Element } from "@app/types";

	let {
		element,
		interactive = true
	}: {
		element: Element;
		interactive?: boolean;
	} = $props();
</script>

<Outline {element} {interactive} />
