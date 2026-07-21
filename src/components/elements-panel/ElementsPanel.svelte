<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import * as ContextMenu from "$lib/components/ui/context-menu";
	import { Input } from "$lib/components/ui/input";
	import { ScrollArea } from "$lib/components/ui/scroll-area";
	import { Separator } from "$lib/components/ui/separator";
	import { Editor } from "editor";
	import FunnelXIcon from "phosphor-svelte/lib/FunnelXIcon";
	import MagnifyingGlassIcon from "phosphor-svelte/lib/MagnifyingGlassIcon";

	import ElementRow from "./ElementRow.svelte";
	import { createElementReorder } from "./use-reorder.svelte";

	const project = Editor.state.project;
	let list: HTMLElement | null = $state(null);
	let viewport: HTMLElement | null = $state(null);
	let backgroundOpen = $state(false);
	let search = $state("");
	let appliedSearch = $state("");
	const validations = $derived(Editor.naming.validate($project.elements));
	const reorder = createElementReorder({ list: () => list, viewport: () => viewport });
	const isSearching = $derived(appliedSearch.length > 0);
	const visibleElements = $derived.by(() => {
		const ordered = isSearching ? [...$project.elements].reverse() : reorder.preview($project.elements);
		if (!appliedSearch) return ordered;
		return ordered.filter((element) => element.name.toLocaleLowerCase().includes(appliedSearch));
	});

	$effect(() => {
		const nextSearch = search.trim().toLocaleLowerCase();
		if (!nextSearch) {
			appliedSearch = "";
			return;
		}
		const timer = setTimeout(() => {
			appliedSearch = nextSearch;
		}, 200);
		return () => clearTimeout(timer);
	});

	function clearSearch() {
		search = "";
		appliedSearch = "";
	}
</script>

<div class="flex min-h-0 flex-1 flex-col pb-6">
	<div class="px-4 pt-3 pb-2"><span class="text-sidebar-foreground/80 text-sm font-bold">Elements</span></div>
	<Separator class="mx-3 opacity-50 data-[orientation=horizontal]:w-auto" />
	<div class="relative m-2 mb-0">
		<MagnifyingGlassIcon
			class="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3 -translate-y-1/2"
		/>
		<Input
			bind:value={search}
			placeholder="Search elements"
			aria-label="Search elements by name"
			class="bg-sidebar-accent/75 h-7 rounded-lg py-1 pr-7 pl-7 text-xs! focus-visible:border-transparent focus-visible:ring-0"
			onkeydown={(event) => {
				if (event.key === "Escape" && search) {
					event.preventDefault();
					clearSearch();
				}
			}}
		/>
		{#if isSearching}
			<Button
				variant="ghost"
				size="icon-xs"
				class="absolute top-1/2 right-0.5 size-6 -translate-y-1/2 rounded-md transition-none active:not-aria-[haspopup]:-translate-y-1/2"
				onclick={clearSearch}
				aria-label="Clear search"
			>
				<FunnelXIcon />
			</Button>
		{/if}
	</div>
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
					{#each visibleElements as element, index (element.id)}
						<ElementRow
							{element}
							{index}
							validation={validations.get(element.id)}
							selected={$project.selectedElementIds.includes(element.id)}
							active={reorder.isActive(element.id)}
							onReorderStart={(event, id, rowIndex) => {
								if (!isSearching) reorder.start(event, id, rowIndex);
							}}
							onSelect={(event, id) => reorder.select(event, id, visibleElements)}
						/>
					{:else}
						<p class="text-muted-foreground px-2 py-1 text-xs">
							{isSearching ? "No matching elements" : "No elements"}
						</p>
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
