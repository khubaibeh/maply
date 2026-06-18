<script lang="ts">
	import type { Tool } from "$lib/editor/model/tools";
	import { toolState } from "$lib/editor/state/tool.svelte";
	import Circle from "@lucide/svelte/icons/circle";
	import Hand from "@lucide/svelte/icons/hand";
	import Image from "@lucide/svelte/icons/image";
	import MousePointer2 from "@lucide/svelte/icons/mouse-pointer-2";
	import Pencil from "@lucide/svelte/icons/pencil";
	import Square from "@lucide/svelte/icons/square";
	import Type from "@lucide/svelte/icons/type";

	const tools = [
		{ id: "select", label: "Select", icon: MousePointer2 },
		{ id: "hand", label: "Hand", icon: Hand },
		{ id: "rect", label: "Rect", icon: Square },
		{ id: "circle", label: "Circle", icon: Circle },
		{ id: "path", label: "Path", icon: Pencil },
		{ id: "text", label: "Text", icon: Type },
		{ id: "image", label: "Image", icon: Image }
	] as const;

	function selectTool(tool: Tool) {
		if ($toolState.isSpacePressed) return;
		toolState.setTool(tool);
		(document.activeElement as HTMLElement | null)?.blur();
	}
</script>

<div class="border-border bg-background flex h-12 shrink-0 items-center gap-1 border-t px-3">
	<div class="flex items-center gap-1" role="toolbar" aria-label="Tools">
		{#each tools as tool (tool.id)}
			{@const Icon = tool.icon}
			{@const isActive = $toolState.activeTool === tool.id}
			<button
				type="button"
				role="radio"
				aria-checked={isActive}
				aria-label={tool.label}
				onclick={() => selectTool(tool.id)}
				class="hover:bg-primary/60 hover:text-primary-foreground flex h-8 items-center gap-1.5 rounded-[0.25rem] px-2 text-xs transition-all duration-300 ease-out active:scale-[0.98] [&_svg:not([class*='size-'])]:size-4 {isActive
					? 'bg-primary text-primary-foreground shadow-sm'
					: 'text-foreground'}"
			>
				<Icon data-icon="inline-start" />
				{tool.label}
			</button>
		{/each}
	</div>
</div>
