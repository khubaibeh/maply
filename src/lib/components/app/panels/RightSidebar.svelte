<script lang="ts">
	import { validateElementNames } from "$lib/app/core/element-name-validation";
	import { canvasState } from "$lib/app/state/canvas.svelte";
	import { projectState } from "$lib/app/state/project.svelte";
	import { Input } from "$lib/components/ui/input";
	import { ScrollArea } from "$lib/components/ui/scroll-area";
	import { Separator } from "$lib/components/ui/separator";

	import ElementNameValidation from "./ElementNameValidation.svelte";
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

	function updateElementName(event: Event, id: string) {
		const value = (event.target as HTMLInputElement).value.trim();
		projectState.renameElement(id, value);
	}

	function autofixElementName(id: string, suggestion: string) {
		projectState.renameElement(id, suggestion);
	}

	const selectedElement = $derived(
		$projectState.elements.find((element) => element.id === $projectState.selectedElementId) ?? null
	);
	const elementNameValidations = $derived(validateElementNames($projectState.elements));
	const selectedElementNameValidation = $derived(
		selectedElement ? (elementNameValidations.get(selectedElement.id) ?? null) : null
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
							onchange={updateWidth}
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
							onchange={updateHeight}
							class="no-spinner h-7 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
						/>
					</div>
				</div>
			</div>

			{#if selectedElement}
				<div class="flex flex-col gap-2">
					<Separator />
					<div class="flex flex-col gap-1">
						<label for="{selectedElement.id}-name" class="text-sidebar-foreground/70 text-xs">Name</label>
						<div class="relative flex items-center">
							<Input
								id="{selectedElement.id}-name"
								type="text"
								value={selectedElement.name}
								onchange={(event) => updateElementName(event, selectedElement.id)}
								aria-invalid={selectedElementNameValidation && !selectedElementNameValidation.valid}
								class="h-7 text-xs {selectedElementNameValidation &&
								!selectedElementNameValidation.valid
									? 'border-destructive bg-destructive/10 text-destructive pr-8 focus-visible:ring-0 focus-visible:ring-offset-0 aria-invalid:ring-0 dark:aria-invalid:ring-0'
									: 'focus-visible:ring-0 focus-visible:ring-offset-0'}"
							/>
							{#if selectedElementNameValidation && !selectedElementNameValidation.valid}
								<ElementNameValidation
									validation={selectedElementNameValidation}
									onAutofix={(suggestion) => autofixElementName(selectedElement.id, suggestion)}
									class="absolute right-2 size-5 rounded-none hover:bg-transparent focus-visible:ring-0 [&_svg]:size-3.5"
								/>
							{/if}
						</div>
					</div>

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
