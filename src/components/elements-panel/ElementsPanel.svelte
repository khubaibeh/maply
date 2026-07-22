<script lang="ts">
	import { downloadName, downloadText } from "$lib/browser-download";
	import { Button } from "$lib/components/ui/button";
	import * as ContextMenu from "$lib/components/ui/context-menu";
	import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
	import { Input } from "$lib/components/ui/input";
	import { ScrollArea } from "$lib/components/ui/scroll-area";
	import { Separator } from "$lib/components/ui/separator";
	import type { ElementType } from "@maply/model/types";
	import { Editor } from "editor";
	import DotsThreeIcon from "phosphor-svelte/lib/DotsThree";
	import FunnelXIcon from "phosphor-svelte/lib/FunnelXIcon";
	import MagnifyingGlassIcon from "phosphor-svelte/lib/MagnifyingGlassIcon";

	import ElementRow from "./ElementRow.svelte";
	import { elementNamesCsv, elementTypeLabels, elementTypes, filterElements, toggleType } from "./filter";
	import { createElementReorder } from "./use-reorder.svelte";

	const project = Editor.state.project;
	let list: HTMLElement | null = $state(null);
	let viewport: HTMLElement | null = $state(null);
	let backgroundOpen = $state(false);
	let search = $state("");
	let appliedSearch = $state("");
	let selectedTypes = $state<ElementType[]>([]);
	const validations = $derived(Editor.naming.validate($project.elements));
	const reorder = createElementReorder({ list: () => list, viewport: () => viewport });
	const isSearching = $derived(appliedSearch.length > 0);
	const hasTypeFilter = $derived(selectedTypes.length > 0);
	const hasActiveFilter = $derived(isSearching || hasTypeFilter);
	const orderedElements = $derived(reorder.preview($project.elements));
	const visibleElements = $derived.by(() => {
		return filterElements(orderedElements, selectedTypes, appliedSearch);
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

	function clearFilters() {
		selectedTypes = [];
		clearSearch();
	}

	function isTypeSelected(type: ElementType) {
		return selectedTypes.includes(type);
	}

	function setTypeSelected(type: ElementType, selected: boolean) {
		selectedTypes = toggleType(selectedTypes, type, selected);
	}

	function exportNames(elements: typeof $project.elements, suffix: string) {
		downloadText(
			downloadName(`${$project.name || "maply-project"}-${suffix}`, "csv"),
			elementNamesCsv(elements),
			"text/csv;charset=utf-8"
		);
	}
</script>

<div class="flex min-h-0 flex-1 flex-col pb-6">
	<div class="grid grid-cols-[minmax(0,1fr)_auto] items-center px-4 pt-3 pb-2">
		<div class="flex min-w-0 items-center gap-2">
			<span class="text-sidebar-foreground/80 truncate text-sm font-bold">Elements</span>
			{#if hasActiveFilter}
				<Button
					variant="ghost"
					size="sm"
					class="bg-destructive/15 text-destructive hover:bg-destructive/20 hover:text-destructive mb-0.5 h-auto max-w-full min-w-0 rounded-md px-1.5 py-0.5 text-xs"
					onclick={clearFilters}
					aria-label="Clear element filters"
					><span class="truncate"
						>{visibleElements.length.toLocaleString()} element{visibleElements.length === 1
							? ""
							: "s"}</span
					></Button
				>
			{/if}
		</div>
		<div class="flex justify-end">
			<DropdownMenu.Root>
				<DropdownMenu.Trigger
					class="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-sidebar-ring/40 inline-flex size-7 items-center justify-center rounded-lg outline-none focus-visible:ring-2"
					aria-label="Element actions"><DotsThreeIcon class="size-4" /></DropdownMenu.Trigger
				>
				<DropdownMenu.Content align="end" class="min-w-40 rounded-xl p-1">
					<DropdownMenu.Group>
						<DropdownMenu.Item
							class="rounded-lg px-2.5 py-1.5 text-xs"
							disabled={visibleElements.length === 0}
							onclick={() => exportNames(visibleElements, "elements")}>Export names</DropdownMenu.Item
						>
						<DropdownMenu.Item
							class="rounded-lg px-2.5 py-1.5 text-xs"
							disabled={orderedElements.length === 0}
							onclick={() => exportNames(orderedElements, "all-elements")}
							>Export all names</DropdownMenu.Item
						>
					</DropdownMenu.Group>
					<DropdownMenu.Separator />
					<DropdownMenu.Group>
						<DropdownMenu.Label class="px-2.5 py-1 text-xs">Filter</DropdownMenu.Label>
						<DropdownMenu.Item
							class="rounded-lg px-2.5 py-1.5 pl-8 text-xs"
							disabled={!hasTypeFilter}
							onclick={() => (selectedTypes = [])}>Clear filter</DropdownMenu.Item
						>
						{#each elementTypes as type (type)}
							<DropdownMenu.CheckboxItem
								class="rounded-lg px-2.5 py-1.5 pl-8 text-xs"
								checked={isTypeSelected(type)}
								closeOnSelect={false}
								onCheckedChange={(selected) => setTypeSelected(type, selected)}
								>{elementTypeLabels[type]}</DropdownMenu.CheckboxItem
							>
						{/each}
					</DropdownMenu.Group>
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		</div>
	</div>
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
								if (!hasActiveFilter) reorder.start(event, id, rowIndex);
							}}
							onSelect={(event, id) => reorder.select(event, id, visibleElements)}
						/>
					{:else}
						<p class="text-muted-foreground px-2 py-1 text-xs">
							{hasActiveFilter ? "No matching elements" : "No elements"}
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
				<ContextMenu.Item
					class="rounded-lg px-2.5 py-1.5 text-xs"
					disabled={Editor.clipboard.get().length === 0}
					onclick={() => {
						void Editor.clipboard.paste();
						backgroundOpen = false;
					}}>Paste</ContextMenu.Item
				>
			</ContextMenu.Group>
		</ContextMenu.Content>
	</ContextMenu.Root>
</div>
