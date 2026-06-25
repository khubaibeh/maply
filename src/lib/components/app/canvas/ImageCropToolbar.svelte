<script lang="ts">
	import type { ImageElement } from "$lib/app/domain/elements";
	import { canvasState } from "$lib/app/state/canvas.svelte";
	import { imageAssetState } from "$lib/app/state/image-assets.svelte";
	import { projectState } from "$lib/app/state/project.svelte";
	import Check from "@lucide/svelte/icons/check";
	import Crop from "@lucide/svelte/icons/crop";
	import Download from "@lucide/svelte/icons/download";
	import ImageIcon from "@lucide/svelte/icons/image";
	import RotateCcw from "@lucide/svelte/icons/rotate-ccw";

	interface Props {
		element: ImageElement;
		cropEditing: boolean;
		containerWidth: number;
		containerHeight: number;
	}

	let { element, cropEditing, containerWidth, containerHeight }: Props = $props();

	const DEFAULT_TOOLBAR_WIDTH = 100;
	const CROP_TOOLBAR_WIDTH = 208;
	const TOOLBAR_HEIGHT = 32;
	const TOOLBAR_GAP = 12;
	const TOOLBAR_BUTTON_SIZE = 25;
	const TOOLBAR_ICON_SIZE = 15;

	let fileInputRef: HTMLInputElement | null = $state(null);

	const imageAsset = $derived(element.assetId ? ($imageAssetState[element.assetId] ?? null) : null);
	const imageHref = $derived(imageAsset?.dataUrl ?? element.href ?? "");
	const downloadName = $derived(imageAsset?.name ?? `${element.name || "image"}.svg`);
	const hasImage = $derived(!!imageHref);

	const toolbarScale = $derived(Math.max(0.9, Math.min(1.1, Math.pow($canvasState.camera.zoom, 0.12))));
	const toolbarWidth = $derived((cropEditing ? CROP_TOOLBAR_WIDTH : DEFAULT_TOOLBAR_WIDTH) * toolbarScale);
	const toolbarHeight = $derived(TOOLBAR_HEIGHT * toolbarScale);
	const toolbarGap = $derived(TOOLBAR_GAP * toolbarScale);
	const toolbarButtonSize = $derived(TOOLBAR_BUTTON_SIZE * toolbarScale);
	const toolbarIconSize = $derived(TOOLBAR_ICON_SIZE * toolbarScale);

	const screenLeft = $derived(
		(element.x + element.width / 2 - $canvasState.camera.x) * $canvasState.camera.zoom - toolbarWidth / 2
	);
	const screenTop = $derived(
		(element.y - $canvasState.camera.y) * $canvasState.camera.zoom - toolbarHeight - toolbarGap
	);

	const left = $derived(Math.max(8, Math.min(containerWidth - toolbarWidth - 8, screenLeft)));
	const top = $derived(Math.max(8, Math.min(containerHeight - toolbarHeight - 8, screenTop)));

	function keepSelected(event: PointerEvent | WheelEvent) {
		event.stopPropagation();
		projectState.selectElement(element.id);
	}

	function resetCrop() {
		projectState.resetImageCrop(element.id);
		projectState.selectElement(element.id);
	}

	function updateCropScale(event: Event) {
		const value = Number((event.currentTarget as HTMLInputElement).value);
		if (Number.isNaN(value)) return;
		projectState.setImageCropScale(element.id, value);
		projectState.selectElement(element.id);
	}

	function finishCrop() {
		projectState.setCropEditingElement(null);
		projectState.selectElement(element.id);
	}

	function startCrop() {
		if (!hasImage) return;
		projectState.setCropEditingElement(element.id);
		projectState.selectElement(element.id);
	}

	function openImagePicker() {
		projectState.selectElement(element.id);
		fileInputRef?.click();
	}

	async function handleImageFileChange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		await projectState.setImageAssetFromFile(element.id, file);
		projectState.selectElement(element.id);
		input.value = "";
	}

	function downloadImage() {
		if (!imageHref) return;

		const link = document.createElement("a");
		link.href = imageHref;
		link.download = downloadName;
		link.click();
		projectState.selectElement(element.id);
	}
</script>

<div
	class="border-border bg-background/96 text-foreground pointer-events-auto absolute z-10 flex items-center justify-center gap-px rounded-md border shadow-sm backdrop-blur-sm transition-[width] duration-150"
	style:left="{left}px"
	style:top="{top}px"
	style:width="{toolbarWidth}px"
	style:height="{toolbarHeight}px"
	style:padding-inline="{4 * toolbarScale}px"
	role="toolbar"
	tabindex="-1"
	aria-label="Image actions"
	onpointerdown={keepSelected}
	onwheel={keepSelected}
>
	<input
		bind:this={fileInputRef}
		type="file"
		accept="image/png,image/jpeg,image/svg+xml,.png,.jpg,.jpeg,.svg"
		onchange={handleImageFileChange}
		class="hidden"
	/>
	{#if cropEditing}
		<button
			type="button"
			class="toolbar-button"
			onclick={resetCrop}
			aria-label="Reset crop"
			title="Reset crop"
			style:width="{toolbarButtonSize}px"
			style:height="{toolbarButtonSize}px"
		>
			<RotateCcw style={`width:${toolbarIconSize}px;height:${toolbarIconSize}px`} />
		</button>
		<div class="flex min-w-0 flex-1 items-center" style:padding-inline="{4 * toolbarScale}px">
			<input
				type="range"
				min="100"
				max="800"
				step="1"
				value={element.cropScale}
				oninput={updateCropScale}
				onpointerdown={keepSelected}
				aria-label="Crop zoom"
				class="crop-slider h-3 w-full cursor-pointer appearance-none bg-transparent"
			/>
		</div>
		<button
			type="button"
			class="toolbar-button"
			onclick={finishCrop}
			aria-label="Done cropping"
			title="Done cropping"
			style:width="{toolbarButtonSize}px"
			style:height="{toolbarButtonSize}px"
		>
			<Check style={`width:${toolbarIconSize}px;height:${toolbarIconSize}px`} />
		</button>
	{:else}
		<button
			type="button"
			class="toolbar-button"
			onclick={openImagePicker}
			aria-label="Replace image"
			title="Replace image"
			style:width="{toolbarButtonSize}px"
			style:height="{toolbarButtonSize}px"
		>
			<ImageIcon style={`width:${toolbarIconSize}px;height:${toolbarIconSize}px`} />
		</button>
		<button
			type="button"
			class="toolbar-button"
			onclick={startCrop}
			aria-label="Edit crop"
			title="Edit crop"
			style:width="{toolbarButtonSize}px"
			style:height="{toolbarButtonSize}px"
			disabled={!hasImage}
		>
			<Crop style={`width:${toolbarIconSize}px;height:${toolbarIconSize}px`} />
		</button>
		<button
			type="button"
			class="toolbar-button"
			onclick={downloadImage}
			aria-label="Download image"
			title="Download image"
			style:width="{toolbarButtonSize}px"
			style:height="{toolbarButtonSize}px"
			disabled={!hasImage}
		>
			<Download style={`width:${toolbarIconSize}px;height:${toolbarIconSize}px`} />
		</button>
	{/if}
</div>

<style>
	.toolbar-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		border: 0;
		border-radius: 6px;
		background: transparent;
		color: inherit;
		padding: 0;
		flex: 0 0 auto;
	}

	.toolbar-button:hover {
		background: color-mix(in oklab, var(--foreground) 8%, transparent);
	}

	.toolbar-button:focus-visible {
		outline: 2px solid color-mix(in oklab, var(--ring) 72%, transparent);
		outline-offset: 1px;
	}

	.toolbar-button:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.toolbar-button:disabled:hover {
		background: transparent;
	}

	.crop-slider::-webkit-slider-runnable-track {
		height: 2px;
		border-radius: 999px;
		background: color-mix(in oklab, var(--foreground) 16%, transparent);
	}

	.crop-slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		margin-top: -4px;
		height: 10px;
		width: 10px;
		border-radius: 999px;
		border: 1px solid var(--primary);
		background: var(--background);
	}

	.crop-slider::-moz-range-track {
		height: 2px;
		border-radius: 999px;
		background: color-mix(in oklab, var(--foreground) 16%, transparent);
	}

	.crop-slider::-moz-range-thumb {
		height: 10px;
		width: 10px;
		border-radius: 999px;
		border: 1px solid var(--primary);
		background: var(--background);
	}
</style>
