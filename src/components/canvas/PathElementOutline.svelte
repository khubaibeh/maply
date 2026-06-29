<script lang="ts">
	import PathOutline from "$lib/components/app/canvas/PathOutline.svelte";
	import type { PathElement } from "@app/types";

	let { element }: { element: PathElement } = $props();
</script>

<PathOutline {element} />
