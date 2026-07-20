<script lang="ts">
	import { Badge } from "$lib/components/ui/badge";
	import { Input } from "$lib/components/ui/input";
	import { ScrollArea } from "$lib/components/ui/scroll-area";
	import { Separator } from "$lib/components/ui/separator";
	import ColorPicker from "@components/core/ColorPicker.svelte";
	import ElementNameValidation from "@components/core/ElementNameValidation.svelte";
	import ElementProperties from "@components/properties/ElementProperties.svelte";
	import { canEditSharedProperties, sharedPropertySelectionLimit } from "@components/properties/shared-properties";
	import SharedProperties from "@components/properties/SharedProperties.svelte";
	import { Editor } from "editor";

	let { width = 288 }: { width?: number } = $props();
	const canvas = Editor.state.canvas;
	const minCanvasSize = Editor.state.minimumCanvasSize;
	const project = Editor.state.project;

	function updateWidth(event: Event) {
		const value = parseInt((event.target as HTMLInputElement).value, 10);
		if (!Number.isNaN(value)) {
			Editor.actions.canvas.setSize(value, $canvas.height);
			Editor.element.clampAll();
		}
	}

	function updateHeight(event: Event) {
		const value = parseInt((event.target as HTMLInputElement).value, 10);
		if (!Number.isNaN(value)) {
			Editor.actions.canvas.setSize($canvas.width, value);
			Editor.element.clampAll();
		}
	}

	function updateElementName(event: Event, id: string) {
		const value = (event.target as HTMLInputElement).value.trim();
		Editor.element.rename(id, value);
	}

	function autofixElementName(id: string, suggestion: string) {
		Editor.element.rename(id, suggestion);
	}

	const selectedElement = $derived(
		$project.selectedElementIds.length === 1
			? ($project.elements.find((element) => element.id === $project.selectedElementId) ?? null)
			: null
	);
	const selectedElementCount = $derived($project.selectedElementIds.length);
	const selectedElements = $derived(
		$project.elements.filter((element) => $project.selectedElementIds.includes(element.id))
	);
	const elementNameValidations = $derived(Editor.naming.validate($project.elements));
	const selectedElementNameValidation = $derived(
		selectedElement ? (elementNameValidations.get(selectedElement.id) ?? null) : null
	);
</script>

<aside class="flex h-full min-h-0 shrink-0 flex-col pb-6" style={`width: ${width}px;`}>
	<div class="px-4 pt-3 pb-2">
		<span class="text-sidebar-foreground/80 text-sm font-bold">Properties</span>
	</div>
	<Separator class="mx-4 w-auto opacity-50" />
	<ScrollArea class="min-h-0 flex-1 [mask-image:linear-gradient(to_bottom,black_calc(100%-2rem),transparent)]">
		<div class="flex flex-col gap-4 p-3">
			<div class="flex flex-col gap-x-2 gap-y-4">
				<span class="text-sidebar-foreground/30 text-sm font-semibold tracking-wide">Canvas</span>
				<div class="grid grid-cols-2 gap-2">
					<div class="flex flex-col gap-1">
						<label for="canvas-width" class="text-sidebar-foreground/70 text-xs">Width</label>
						<Input
							id="canvas-width"
							type="number"
							min={$minCanvasSize.width}
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
							min={$minCanvasSize.height}
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
					onChange={Editor.actions.canvas.setColor}
				/>
			</div>

			{#if selectedElementCount > 1}
				<div
					class="border-sidebar-border/70 bg-sidebar-accent/25 flex flex-col gap-3 rounded-2xl border border-dashed px-4 py-5"
				>
					<div class="flex items-center gap-2">
						<Badge variant="secondary">{selectedElementCount} selected</Badge>
					</div>
					{#if canEditSharedProperties(selectedElementCount)}
						<SharedProperties elements={selectedElements} />
					{:else}
						<p class="text-sidebar-foreground/75 text-sm leading-6">
							Multi element support for selections over {sharedPropertySelectionLimit} elements is coming soon.
						</p>
					{/if}
				</div>
			{:else if selectedElement}
				<div class="flex flex-col gap-x-2 gap-y-4">
					<Separator class="mx-4 my-2 w-auto opacity-50" />
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
								? 'bg-destructive/10 text-destructive focus-visible:aria-invalid:border-destructive focus-visible:ring-0 focus-visible:ring-offset-0 aria-invalid:border-transparent aria-invalid:ring-0 dark:aria-invalid:border-transparent dark:aria-invalid:ring-0'
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
