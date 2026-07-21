<script lang="ts">
	import * as ContextMenu from "$lib/components/ui/context-menu";
	import { ScrollArea } from "$lib/components/ui/scroll-area";
	import { Separator } from "$lib/components/ui/separator";
	import { Editor } from "editor";

	import ElementRow from "./ElementRow.svelte";
	import { createElementReorder } from "./use-reorder.svelte";

	const project = Editor.state.project;
	let list: HTMLElement | null = $state(null);
	let viewport: HTMLElement | null = $state(null);
	let backgroundOpen = $state(false);
	const validations = $derived(Editor.naming.validate($project.elements));
	const reorder = createElementReorder({ list: () => list, viewport: () => viewport });
</script>

<div class="flex min-h-0 flex-1 flex-col pb-6">
	<div class="px-4 pt-3 pb-2"><span class="text-sidebar-foreground/80 text-sm font-bold">Elements</span></div>
	<Separator class="mx-3 opacity-50 data-[orientation=horizontal]:w-auto" />
	<ContextMenu.Root bind:open={backgroundOpen}>
		<ContextMenu.Trigger class="contents">
			<ScrollArea
				class="min-h-0 flex-1 [mask-image:linear-gradient(to_bottom,black_calc(100%-2rem),transparent)]"
				bind:viewportRef={viewport}
			>
				<div
					bind:this={list}
					class="flex min-h-full flex-col gap-0.5 p-2"
					role="presentation"
					onpointerdown={(event) => {
						if (event.target === event.currentTarget) Editor.selection.select(null);
					}}
				>
					{#each reorder.preview($project.elements) as element, index (element.id)}
						{@const projectIndex = $project.elements.findIndex((entry) => entry.id === element.id)}
						<ElementRow
							{element}
							{index}
							validation={validations.get(element.id)}
							selected={$project.selectedElementIds.includes(element.id)}
							active={reorder.isActive(element.id)}
							frontmost={projectIndex === $project.elements.length - 1}
							backmost={projectIndex === 0}
							onReorderStart={reorder.start}
							onSelect={reorder.select}
						/>
					{:else}
						<p class="text-muted-foreground px-2 py-1 text-xs">No elements</p>
					{/each}
				</div>
			</ScrollArea>
		</ContextMenu.Trigger>
		<ContextMenu.Content class="min-w-40 rounded-xl p-1">
			<ContextMenu.Group>
				<ContextMenu.Item
					class="rounded-lg px-2.5 py-1.5 text-xs"
					disabled={$project.elements.length === 0}
					onclick={() => {
						Editor.selection.selectAll();
						backgroundOpen = false;
					}}>Select all</ContextMenu.Item
				>
			</ContextMenu.Group>
		</ContextMenu.Content>
	</ContextMenu.Root>
</div>
