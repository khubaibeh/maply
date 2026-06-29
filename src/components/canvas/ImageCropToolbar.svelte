<script lang="ts">
	import ImageCropToolbar from "$lib/components/app/canvas/ImageCropToolbar.svelte";
	import type { ImageElement } from "@app/types";

	let {
		element,
		cropEditing,
		containerWidth,
		containerHeight
	}: {
		element: ImageElement;
		cropEditing: boolean;
		containerWidth: number;
		containerHeight: number;
	} = $props();
</script>

<ImageCropToolbar {element} {cropEditing} {containerWidth} {containerHeight} />
