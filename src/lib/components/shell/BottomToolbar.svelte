<script lang="ts">
	import * as ToggleGroup from '$lib/components/ui/toggle-group';
	import { Separator } from '$lib/components/ui/separator';
	import MousePointer2 from '@lucide/svelte/icons/mouse-pointer-2';
	import Hand from '@lucide/svelte/icons/hand';
	import Square from '@lucide/svelte/icons/square';
	import Circle from '@lucide/svelte/icons/circle';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Type from '@lucide/svelte/icons/type';
	import Image from '@lucide/svelte/icons/image';

	const tools = [
		{ id: 'select', label: 'Select', icon: MousePointer2 },
		{ id: 'hand', label: 'Hand', icon: Hand },
		{ id: 'rect', label: 'Rect', icon: Square },
		{ id: 'circle', label: 'Circle', icon: Circle },
		{ id: 'path', label: 'Path', icon: Pencil },
		{ id: 'text', label: 'Text', icon: Type },
		{ id: 'image', label: 'Image', icon: Image }
	] as const;

	let activeTool = $state<string>('select');
</script>

<div class="flex h-12 shrink-0 items-center gap-1 border-t border-border bg-background px-3">
	<ToggleGroup.Root type="single" bind:value={activeTool} variant="default" size="sm" class="gap-1">
		{#each tools as tool, i (tool.id)}
			{@const Icon = tool.icon}
			{#if i === 2}
				<Separator orientation="vertical" class="mx-1 h-5" />
			{/if}
			<ToggleGroup.Item
				value={tool.id}
				aria-label={tool.label}
				class="h-8 gap-1.5 rounded-lg px-2 text-xs transition-colors hover:bg-accent/60 hover:text-accent-foreground data-[state=on]:bg-accent data-[state=on]:text-accent-foreground"
			>
				<Icon data-icon="inline-start" />
				{tool.label}
			</ToggleGroup.Item>
		{/each}
	</ToggleGroup.Root>
</div>
