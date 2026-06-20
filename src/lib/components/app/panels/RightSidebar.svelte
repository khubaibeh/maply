<script lang="ts">
	import { canvasState } from "$lib/app/state/canvas.svelte";
	import { projectState } from "$lib/app/state/project.svelte";
	import { Input } from "$lib/components/ui/input";
	import { ScrollArea } from "$lib/components/ui/scroll-area";

	import ElementProperties from "./Elements.svelte";

	function updateWidth(event: Event) {
		const value = parseInt((event.target as HTMLInputElement).value, 10);
		if (!Number.isNaN(value)) {
			canvasState.setSize(value, $canvasState.height);
			projectState.clampElementsToCanvas();
		}
	}

	function updateHeight(event: Event) {
		const value = parseInt((event.target as HTMLInputElement).value, 10);
		if (!Number.isNaN(value)) {
			canvasState.setSize($canvasState.width, value);
			projectState.clampElementsToCanvas();
		}
	}

	const selectedElement = $derived(
		$projectState.elements.find((element) => element.id === $projectState.selectedElementId) ?? null
	);
</script>

<aside class="border-border bg-sidebar flex w-72 shrink-0 flex-col border-l">
	<div class="border-border border-b px-3 py-2">
		<span class="text-sidebar-foreground/80 text-xs font-semibold tracking-wide uppercase">Properties</span>
	</div>
	<ScrollArea class="h-full">
		<div class="flex flex-col gap-4 p-3">
			<div class="flex flex-col gap-2">
				<span class="text-sidebar-foreground/80 text-xs font-semibold tracking-wide">Canvas</span>
				<div class="grid grid-cols-2 gap-2">
					<div class="flex flex-col gap-1">
						<label for="canvas-width" class="text-sidebar-foreground/70 text-xs">Width</label>
						<Input
							id="canvas-width"
							type="number"
							min={1}
							step={1}
							value={$canvasState.width}
							oninput={updateWidth}
							class="no-spinner h-7 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
						/>
					</div>
					<div class="flex flex-col gap-1">
						<label for="canvas-height" class="text-sidebar-foreground/70 text-xs">Height</label>
						<Input
							id="canvas-height"
							type="number"
							min={1}
							step={1}
							value={$canvasState.height}
							oninput={updateHeight}
							class="no-spinner h-7 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
						/>
					</div>
				</div>
			</div>

			{#if selectedElement}
				<div class="flex flex-col gap-2">
					<span class="text-sidebar-foreground/80 text-xs font-semibold tracking-wide">
						{selectedElement.name}
					</span>
					<ElementProperties element={selectedElement} />
				</div>
			{/if}
		</div>
	</ScrollArea>
</aside>

<style>
	:global(.no-spinner::-webkit-inner-spin-button),
	:global(.no-spinner::-webkit-outer-spin-button) {
		-webkit-appearance: none;
		margin: 0;
	}

	:global(.no-spinner) {
		-moz-appearance: textfield;
		appearance: textfield;
	}
</style>
