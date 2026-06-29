<script lang="ts">
	import ImageCropOverlay from "$lib/components/app/canvas/ImageCropOverlay.svelte";
	import type { ImageElement } from "@app/types";

	let {
		element,
		cropEditing
	}: {
		element: ImageElement;
		cropEditing: boolean;
	} = $props();
</script>

<ImageCropOverlay {element} {cropEditing} />
