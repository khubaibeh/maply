<script lang="ts">
	import { ScrollArea } from '$lib/components/ui/scroll-area';
	import { Input } from '$lib/components/ui/input';
	import { canvasState } from '$lib/state/canvas.svelte';

	function updateWidth(event: Event) {
		const value = parseInt((event.target as HTMLInputElement).value, 10);
		if (!Number.isNaN(value)) {
			canvasState.setSize(value, canvasState.height);
		}
	}

	function updateHeight(event: Event) {
		const value = parseInt((event.target as HTMLInputElement).value, 10);
		if (!Number.isNaN(value)) {
			canvasState.setSize(canvasState.width, value);
		}
	}
</script>

<aside class="flex w-72 shrink-0 flex-col border-l border-border bg-sidebar">
	<div class="border-b border-border px-3 py-2">
		<span class="text-xs font-semibold tracking-wide uppercase text-sidebar-foreground/80"
			>Properties</span
		>
	</div>
	<ScrollArea class="h-full">
		<div class="p-3">
			<div class="flex flex-col gap-2">
				<span class="text-xs font-semibold tracking-wide text-sidebar-foreground/80">Canvas</span>
				<div class="grid grid-cols-2 gap-2">
					<div class="flex flex-col gap-1">
						<label for="canvas-width" class="text-xs text-sidebar-foreground/70">Width</label>
						<Input
							id="canvas-width"
							type="number"
							min={1}
							value={canvasState.width}
							onchange={updateWidth}
							class="h-7 text-xs"
						/>
					</div>
					<div class="flex flex-col gap-1">
						<label for="canvas-height" class="text-xs text-sidebar-foreground/70">Height</label>
						<Input
							id="canvas-height"
							type="number"
							min={1}
							value={canvasState.height}
							onchange={updateHeight}
							class="h-7 text-xs"
						/>
					</div>
				</div>
			</div>
		</div>
	</ScrollArea>
</aside>
