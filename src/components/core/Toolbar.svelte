<script lang="ts">
	import * as Tooltip from "$lib/components/ui/tooltip";
	import { App } from "@app";
	import type { Tool } from "@app/types";
	import Circle from "phosphor-svelte/lib/Circle";
	import Cursor from "phosphor-svelte/lib/Cursor";
	import Hand from "phosphor-svelte/lib/Hand";
	import Image from "phosphor-svelte/lib/Image";
	import Pencil from "phosphor-svelte/lib/Pencil";
	import Rectangle from "phosphor-svelte/lib/Rectangle";
	import TextT from "phosphor-svelte/lib/TextT";

	const tools = [
		{ id: "select", label: "Select", shortcut: "V", icon: Cursor },
		{ id: "hand", label: "Hand", shortcut: "H", icon: Hand },
		{ id: "rect", label: "Rect", shortcut: "R", icon: Rectangle },
		{ id: "circle", label: "Circle", shortcut: "C", icon: Circle },
		{ id: "path", label: "Path", shortcut: "P", icon: Pencil },
		{ id: "text", label: "Text", shortcut: "T", icon: TextT },
		{ id: "image", label: "Image", shortcut: "I", icon: Image }
	] as const;
	const toolState = App.state.tool;

	function selectTool(nextTool: Tool) {
		if ($toolState.isSpacePressed) return;
		App.actions.tool.set(nextTool);
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
