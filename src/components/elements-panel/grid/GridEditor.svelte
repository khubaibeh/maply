<script lang="ts">
	import * as ContextMenu from "$lib/components/ui/context-menu";
	import { ScrollArea } from "$lib/components/ui/scroll-area";
	import ArrowDownIcon from "phosphor-svelte/lib/ArrowDown";
	import ArrowUpIcon from "phosphor-svelte/lib/ArrowUp";
	import ClipboardIcon from "phosphor-svelte/lib/Clipboard";
	import CopyIcon from "phosphor-svelte/lib/Copy";
	import ListChecksIcon from "phosphor-svelte/lib/ListChecks";
	import PlusIcon from "phosphor-svelte/lib/Plus";
	import TrashIcon from "phosphor-svelte/lib/Trash";

	import GridCell from "./GridCell.svelte";
	import GridHeaderCell from "./GridHeaderCell.svelte";
	import type { Grid } from "./use-grid.svelte";

	interface Props {
		grid: Grid;
	}

	let { grid }: Props = $props();
	let gridContainer: HTMLElement | null = $state(null);
	// The row right-click selection is transient: cleared when the menu closes,
	// unless an action (e.g. "Select all rows") opts to keep it.
	let keepSelectionOnClose = $state(false);

	function onRowMenuOpenChange(open: boolean) {
		if (!open) {
			if (!keepSelectionOnClose) grid.clearHeaderSelection();
			keepSelectionOnClose = false;
		}
	}

	function handlePaste(event: ClipboardEvent) {
		event.preventDefault();
		const text = event.clipboardData?.getData("text/plain");
		if (text) {
			grid.handlePaste(text);
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		// Only handle if not typing in an input
		if (event.target === gridContainer || (event.target as HTMLElement)?.getAttribute("role") === "gridcell") {
			grid.handleKeydown(event);
		}
	}
</script>

<div
	bind:this={gridContainer}
	data-grid-root
	class="border-border/30 bg-background/50 flex min-h-0 w-full flex-1 flex-col gap-0 overflow-hidden rounded-lg border"
	role="grid"
	onpaste={handlePaste}
	onkeydown={handleKeydown}
	tabindex={-1}
>
	<ScrollArea class="min-h-0 flex-1">
		<!-- Header row -->
		<div class="bg-background sticky top-0 z-10 flex">
			<!-- Corner cell above the serial-number gutter: click to select all rows -->
			<button
				type="button"
				onclick={() => grid.selectAllRows()}
				class="border-border w-12 shrink-0 cursor-pointer border-r border-b-2 transition-colors {grid.headerSel
					?.kind === 'row' && grid.headerSel.indices.size === grid.dims.rows
					? 'bg-primary/20'
					: 'bg-sidebar/50 hover:bg-sidebar/70'}"
				aria-label="Select all rows"
			></button>
			<div class="grid flex-1 gap-0" style="grid-template-columns: repeat({grid.dims.cols}, minmax(100px, 1fr));">
				{#each grid.headers as header, colIndex (colIndex)}
					<GridHeaderCell
						{colIndex}
						value={header}
						selected={grid.allRowsSelected ||
							(grid.headerSel?.kind === "col" && grid.headerSel.indices.has(colIndex))}
						{grid}
					/>
				{/each}
			</div>
			<!-- Add-column button, beside the column headers -->
			<button
				type="button"
				onclick={() => grid.addNewColumn()}
				class="border-border bg-sidebar/50 text-muted-foreground hover:bg-sidebar/70 hover:text-foreground flex w-9 shrink-0 items-center justify-center border-b-2 transition-colors"
				aria-label="Add column"
			>
				<PlusIcon class="size-4" />
			</button>
		</div>

		<!-- Data rows -->
		<div class="flex flex-col gap-0">
			{#each grid.rows as row, rowIndex (row)}
				{@const rowSelected = grid.headerSel?.kind === "row" && grid.headerSel.indices.has(rowIndex)}
				<div class="flex {rowSelected ? 'bg-primary/10' : ''}" role="row">
					<!-- Serial-number gutter: press or drag to select rows, right-click for row actions -->
					<ContextMenu.Root onOpenChange={onRowMenuOpenChange}>
						<ContextMenu.Trigger
							onpointerdown={(event) => {
								if (event.button !== 0) return;
								event.preventDefault();
								grid.startRowSelection(rowIndex, event.shiftKey, event.ctrlKey || event.metaKey);
							}}
							onpointerenter={(event) => {
								if ((event.buttons & 1) !== 0) grid.extendRowSelection(rowIndex);
							}}
							oncontextmenu={() => {
								// Right-clicking a row selects it (clearing the cell cursor) unless it's already in the selection
								if (!(grid.headerSel?.kind === "row" && grid.headerSel.indices.has(rowIndex))) {
									grid.selectRow(rowIndex, false, false);
								}
							}}
							class="border-border flex w-12 shrink-0 cursor-pointer items-center justify-center border-r border-b text-[10px] tabular-nums transition-colors select-none {rowSelected
								? 'bg-primary/20 text-foreground font-semibold'
								: 'bg-sidebar/50 text-muted-foreground hover:bg-sidebar/70'}"
							aria-label={`Row ${rowIndex + 1}`}
						>
							{rowIndex + 1}
						</ContextMenu.Trigger>
						<ContextMenu.Content
							class="border-border w-40 min-w-0 rounded-lg border p-1 ring-0"
							onInteractOutside={(event) => {
								if (
									event.target instanceof Element &&
									event.target.closest("[data-grid-selection-action]")
								) {
									keepSelectionOnClose = true;
								}
							}}
						>
							<ContextMenu.Item
								class="gap-2 rounded-md px-2 py-1 text-xs [&_svg:not([class*='size-'])]:size-3.5"
								onclick={() => {
									keepSelectionOnClose = true;
									grid.selectAllRows();
								}}
							>
								<ListChecksIcon />
								Select all rows
							</ContextMenu.Item>
							<ContextMenu.Separator />
							<ContextMenu.Item
								class="gap-2 rounded-md px-2 py-1 text-xs [&_svg:not([class*='size-'])]:size-3.5"
								onclick={() => grid.insertRowAbove(rowIndex)}
							>
								<PlusIcon />
								New row above
							</ContextMenu.Item>
							<ContextMenu.Item
								class="gap-2 rounded-md px-2 py-1 text-xs [&_svg:not([class*='size-'])]:size-3.5"
								onclick={() => grid.moveRowUp(rowIndex)}
							>
								<ArrowUpIcon />
								Shift up
							</ContextMenu.Item>
							<ContextMenu.Item
								class="gap-2 rounded-md px-2 py-1 text-xs [&_svg:not([class*='size-'])]:size-3.5"
								onclick={() => grid.moveRowDown(rowIndex)}
							>
								<ArrowDownIcon />
								Shift down
							</ContextMenu.Item>
							<ContextMenu.Separator />
							<ContextMenu.Item
								class="gap-2 rounded-md px-2 py-1 text-xs [&_svg:not([class*='size-'])]:size-3.5"
								onclick={() => grid.copyRows(rowIndex)}
							>
								<CopyIcon />
								Copy
							</ContextMenu.Item>
							<ContextMenu.Item
								class="gap-2 rounded-md px-2 py-1 text-xs [&_svg:not([class*='size-'])]:size-3.5"
								onclick={() => grid.pasteRowsAbove(rowIndex)}
							>
								<ClipboardIcon />
								Paste above
							</ContextMenu.Item>
							<ContextMenu.Separator />
							<ContextMenu.Item
								variant="destructive"
								class="gap-2 rounded-md px-2 py-1 text-xs [&_svg:not([class*='size-'])]:size-3.5"
								onclick={() => grid.deleteRowAt(rowIndex)}
							>
								<TrashIcon />
								Delete
							</ContextMenu.Item>
						</ContextMenu.Content>
					</ContextMenu.Root>
					<div
						class="grid flex-1 gap-0"
						style="grid-template-columns: repeat({grid.dims.cols}, minmax(100px, 1fr));"
					>
						{#each row as cell, colIndex (colIndex)}
							{@const addr = { r: rowIndex, c: colIndex }}
							<GridCell {addr} value={cell} status={grid.selectedCellStatus(addr)} {grid} />
						{/each}
					</div>
					<!-- Spacer aligning data cells with the add-column button -->
					<div class="border-border w-9 shrink-0 border-b" aria-hidden="true"></div>
				</div>
			{/each}
			<!-- Add-row button: full-width bar below the last row -->
			<button
				type="button"
				onclick={() => grid.addNewRow()}
				class="border-border bg-sidebar/50 text-muted-foreground hover:bg-sidebar/70 hover:text-foreground flex h-8 w-full items-center gap-1 border-b pl-4 text-xs transition-colors"
				aria-label="Add row"
			>
				<PlusIcon class="size-4" />
				Add Row
			</button>
		</div>
	</ScrollArea>
</div>
