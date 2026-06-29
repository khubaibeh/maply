<script lang="ts">
	import PathHandles from "$lib/components/app/canvas/PathHandles.svelte";
	import type { PathElement } from "@app/types";

	let { element }: { element: PathElement } = $props();
</script>

<PathHandles {element} />
