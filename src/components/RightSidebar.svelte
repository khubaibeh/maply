<script lang="ts">
	import { Input } from "$lib/components/ui/input";
	import { ScrollArea } from "$lib/components/ui/scroll-area";
	import { App } from "@app";
	import ColorPicker from "@components/core/ColorPicker.svelte";
	import ElementNameValidation from "@components/core/ElementNameValidation.svelte";
	import ElementProperties from "@components/ElementProperties.svelte";

	let { width = 288 }: { width?: number } = $props();
	const canvas = App.state.canvas;
	const project = App.state.project;

	function updateWidth(event: Event) {
		const value = parseInt((event.target as HTMLInputElement).value, 10);
		if (!Number.isNaN(value)) {
			App.actions.canvas.setSize(value, $canvas.height);
			App.actions.project.clampElementsToCanvas();
		}
	}

	function updateHeight(event: Event) {
		const value = parseInt((event.target as HTMLInputElement).value, 10);
		if (!Number.isNaN(value)) {
			App.actions.canvas.setSize($canvas.width, value);
			App.actions.project.clampElementsToCanvas();
		}
	}

	function updateElementName(event: Event, id: string) {
		const value = (event.target as HTMLInputElement).value.trim();
		App.actions.project.renameElement(id, value);
	}

	function autofixElementName(id: string, suggestion: string) {
		App.actions.project.renameElement(id, suggestion);
	}

	const selectedElement = $derived(
		$project.elements.find((element) => element.id === $project.selectedElementId) ?? null
	);
	const elementNameValidations = $derived(App.validate.elementNames($project.elements));
	const selectedElementNameValidation = $derived(
		selectedElement ? (elementNameValidations.get(selectedElement.id) ?? null) : null
	);
</script>

<aside class="border-border bg-sidebar flex shrink-0 flex-col" style={`width: ${width}px;`}>
	<div class="px-4 pt-3 pb-2">
		<span class="text-sidebar-foreground/80 text-sm font-bold">Properties</span>
	</div>
	<hr class="mx-4 opacity-50" />
	<ScrollArea class="h-full">
		<div class="flex flex-col gap-4 p-3">
			<div class="flex flex-col gap-x-2 gap-y-4">
				<span class="text-sidebar-foreground/30 text-sm font-semibold tracking-wide">Canvas</span>
				<div class="grid grid-cols-2 gap-2">
					<div class="flex flex-col gap-1">
						<label for="canvas-width" class="text-sidebar-foreground/70 text-xs">Width</label>
						<Input
							id="canvas-width"
							type="number"
							min={1}
							step={1}
							value={$canvas.width}
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
							value={$canvas.height}
							onchange={updateHeight}
							class="no-spinner h-7 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
						/>
					</div>
				</div>
				<ColorPicker
					id="canvas-color"
					label="Color"
					value={$canvas.color}
					onChange={App.actions.canvas.setColor}
				/>
			</div>

			{#if selectedElement}
				<div class="flex flex-col gap-x-2 gap-y-4">
					<hr class="mx-4 my-2 opacity-50" />
					<span class="text-sidebar-foreground/30 text-sm font-semibold tracking-wide">Element</span>
					<div class="flex flex-col gap-1">
						<label for="{selectedElement.id}-name" class="text-sidebar-foreground/70 text-xs">Name</label>
						<Input
							id="{selectedElement.id}-name"
							type="text"
							value={selectedElement.name}
							onchange={(event) => updateElementName(event, selectedElement.id)}
							aria-invalid={selectedElementNameValidation && !selectedElementNameValidation.valid}
							class="h-7 text-xs {selectedElementNameValidation && !selectedElementNameValidation.valid
								? 'border-destructive bg-destructive/10 text-destructive focus-visible:ring-0 focus-visible:ring-offset-0 aria-invalid:ring-0 dark:aria-invalid:ring-0'
								: 'focus-visible:ring-0 focus-visible:ring-offset-0'}"
						/>
						{#if selectedElementNameValidation && !selectedElementNameValidation.valid}
							<ElementNameValidation
								validation={selectedElementNameValidation}
								onAutofix={(suggestion) => autofixElementName(selectedElement.id, suggestion)}
								variant="inline"
								class="mt-1"
							/>
						{/if}
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
