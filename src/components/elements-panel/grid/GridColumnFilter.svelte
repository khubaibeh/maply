<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
	import { Input } from "$lib/components/ui/input";
	import { ScrollArea } from "$lib/components/ui/scroll-area";
	import FunnelIcon from "phosphor-svelte/lib/Funnel";
	import MagnifyingGlassIcon from "phosphor-svelte/lib/MagnifyingGlass";
	import { SvelteSet } from "svelte/reactivity";

	import type { GridColumn } from "./grid-filter";
	import { searchedFilterValues } from "./grid-filter";
	import type { Grid } from "./use-grid.svelte";

	interface Props {
		column: GridColumn;
		values: readonly string[];
		selected: ReadonlySet<string>;
		active: boolean;
		grid: Grid;
	}

	let { column, values, selected, active, grid }: Props = $props();
	let open = $state(false);
	let search = $state("");
	let addToSelection = $state(false);
	const draft = new SvelteSet<string>();
	const searchedValues = $derived(searchedFilterValues(values, search));

	function resetDraft() {
		search = "";
		addToSelection = false;
		draft.clear();
		for (const value of active ? selected : values) draft.add(value);
	}

	function syncFilter() {
		if (values.length === draft.size && values.every((value) => draft.has(value))) {
			grid.clearFilter(column);
			return;
		}
		grid.applyFilter(column, draft);
	}

	function setSearch(value: string) {
		search = value;
		if (addToSelection) return;
		draft.clear();
		for (const option of searchedFilterValues(values, value)) draft.add(option);
		syncFilter();
	}

	function toggleAddToSelection() {
		addToSelection = !addToSelection;
		if (!addToSelection) setSearch(search);
	}

	function toggleValue(value: string) {
		if (draft.has(value)) draft.delete(value);
		else draft.add(value);
		syncFilter();
	}

	function clear() {
		grid.clearFilter(column);
		draft.clear();
		for (const value of values) draft.add(value);
	}
</script>

<DropdownMenu.Root
	bind:open
	onOpenChange={(next) => {
		if (next) resetDraft();
	}}
>
	<DropdownMenu.Trigger
		class="hover:bg-muted text-muted-foreground hover:text-foreground inline-flex size-5 shrink-0 items-center justify-center rounded-sm outline-none"
		aria-label={active ? `Filter column, ${selected.size} selected` : "Filter column"}
		onpointerdown={(event) => event.stopPropagation()}
		onclick={(event) => event.stopPropagation()}
	>
		<FunnelIcon class={active ? "text-primary" : ""} />
	</DropdownMenu.Trigger>
	<DropdownMenu.Content class="w-52 rounded-xl p-1.5" align="end">
		<div class="flex flex-col gap-2">
			<div class="relative">
				<MagnifyingGlassIcon
					class="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2"
				/>
				<Input
					class="h-7 pl-7 text-xs"
					placeholder="Search values"
					aria-label="Search values"
					value={search}
					oninput={(event) => setSearch(event.currentTarget.value)}
				/>
			</div>
			<div class="flex items-center justify-between gap-2">
				<Button
					variant={addToSelection ? "secondary" : "ghost"}
					size="sm"
					class="h-6 px-1.5 text-xs"
					onclick={toggleAddToSelection}
				>
					Add to selection
				</Button>
			</div>
		</div>
		<DropdownMenu.Separator />
		<ScrollArea class="h-44">
			<div class="flex flex-col gap-0.5 py-0.5" role="group" aria-label="Filter values">
				{#each searchedValues as value (value)}
					<label class="hover:bg-accent flex h-7 cursor-pointer items-center gap-2 rounded-md px-2 text-xs">
						<input
							type="checkbox"
							checked={draft.has(value)}
							class="accent-primary size-3 shrink-0 cursor-pointer"
							onchange={() => toggleValue(value)}
						/>
						<span class="truncate">{value || "(Blank)"}</span>
					</label>
				{:else}
					<DropdownMenu.Label class="text-muted-foreground px-2 py-3 text-xs"
						>No values found</DropdownMenu.Label
					>
				{/each}
			</div>
		</ScrollArea>
		<DropdownMenu.Separator />
		<div class="flex items-center justify-start gap-2 p-1">
			<Button variant="ghost" size="sm" class="h-6 px-1.5 text-xs" disabled={!active} onclick={clear}
				>Clear filter</Button
			>
		</div>
	</DropdownMenu.Content>
</DropdownMenu.Root>
