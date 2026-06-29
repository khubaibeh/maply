<script lang="ts">
	import Background from "$lib/components/app/canvas/Background.svelte";
	import type { Camera } from "@app/types";

	let {
		containerWidth,
		containerHeight,
		camera
	}: {
		containerWidth: number;
		containerHeight: number;
		camera: Camera;
	} = $props();
</script>

<Background {containerWidth} {containerHeight} {camera} />
