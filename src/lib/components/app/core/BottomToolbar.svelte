<script lang="ts">
	import type { Tool } from "$lib/app/domain/tools";
	import { toolState } from "$lib/app/state/tool.svelte";
	import * as Tooltip from "$lib/components/ui/tooltip";
	import Circle from "@lucide/svelte/icons/circle";
	import Hand from "@lucide/svelte/icons/hand";
	import Image from "@lucide/svelte/icons/image";
	import MousePointer2 from "@lucide/svelte/icons/mouse-pointer-2";
	import Pencil from "@lucide/svelte/icons/pencil";
	import Square from "@lucide/svelte/icons/square";
	import Type from "@lucide/svelte/icons/type";

	const tools = [
		{ id: "select", label: "Select", shortcut: "V", icon: MousePointer2 },
		{ id: "hand", label: "Hand", shortcut: "H", icon: Hand },
		{ id: "rect", label: "Rect", shortcut: "R", icon: Square },
		{ id: "circle", label: "Circle", shortcut: "C", icon: Circle },
		{ id: "path", label: "Path", shortcut: "P", icon: Pencil },
		{ id: "text", label: "Text", shortcut: "T", icon: Type },
		{ id: "image", label: "Image", shortcut: "I", icon: Image }
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
			<Tooltip.Root>
				<Tooltip.Trigger
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
				</Tooltip.Trigger>
				<Tooltip.Content side="top" align="center" sideOffset={8}>
					{tool.shortcut}
				</Tooltip.Content>
			</Tooltip.Root>
		{/each}
	</div>
</div>
