<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import { Portal } from "bits-ui";
	import GridNineIcon from "phosphor-svelte/lib/GridNineIcon";
	import TrashIcon from "phosphor-svelte/lib/Trash";
	import XIcon from "phosphor-svelte/lib/XIcon";

	import GridEditor from "./grid/GridEditor.svelte";
	// Import Data section hidden for now — revisit later.
	// import GridImportDropzone from "./grid/GridImportDropzone.svelte";
	import { createGrid } from "./grid/use-grid.svelte";

	interface Props {
		onClose: () => void;
	}

	let { onClose }: Props = $props();
	const grid = createGrid(10);
	// let warnings: any[] = $state([]);
</script>

<Portal to="body">
	<div
		class="bg-background/20 fixed inset-0 z-50 flex items-center justify-center p-10 backdrop-blur-[2px]"
		role="dialog"
		aria-modal="true"
		aria-labelledby="import-names-title"
	>
		<section
			class="border-border bg-background text-foreground flex h-full max-h-[800px] min-h-[600px] w-full max-w-[1000px] min-w-[400px] flex-col rounded-2xl border shadow-2xl"
		>
			<div class="border-border/20 flex items-center justify-between border-b px-6 py-5">
				<h2 id="import-names-title" class="flex items-center gap-2 text-base font-semibold">
					<GridNineIcon class="size-5" />
					Element Names
				</h2>
				<Button
					variant="ghost"
					size="icon-xs"
					class="rounded-md"
					onclick={onClose}
					aria-label="Close import names"
				>
					<XIcon />
				</Button>
			</div>

			<!-- Clicking anywhere outside the grid clears the row/column header selection -->
			<div
				class="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-6"
				role="presentation"
				onclick={(event) => {
					if (event.target instanceof Element && !event.target.closest("[data-grid-root]")) {
						grid.clearHeaderSelection();
					}
				}}
			>
				<!-- Import Data section hidden for now — revisit later.
			<div>
				<h3 class="text-sm font-medium mb-3">Import Data</h3>
				<GridImportDropzone {grid} onImport={(w) => (warnings = w)} />
			</div>

			{#if warnings.length > 0}
				<div class="rounded-lg bg-warning/10 text-warning text-sm p-3">
					<p class="font-medium mb-1">Import Warnings</p>
					<ul class="list-disc list-inside">
						{#each warnings as warning}
							<li>{warning.message}</li>
						{/each}
					</ul>
				</div>
			{/if}
			-->

				<div class="flex min-h-0 flex-1 flex-col">
					<div class="mb-3 flex min-h-8 items-center justify-between">
						<h3 class="text-sm font-medium">Edit Names</h3>
						{#if grid.headerSel}
							<Button
								data-grid-selection-action
								size="sm"
								variant="destructive"
								onclick={() => grid.deleteSelected()}
								class="flex items-center gap-1"
							>
								<TrashIcon class="size-4" />
								Delete {grid.headerSel.kind === "row" ? "Rows" : "Columns"}
							</Button>
						{/if}
					</div>
					<GridEditor {grid} />
				</div>
			</div>

			<div class="border-border/20 flex items-center justify-between border-t px-6 py-4">
				<p class="text-muted-foreground text-xs">
					Click cells to edit. Double-click headers to rename columns.
				</p>
				<Button variant="default" onclick={onClose}>Done</Button>
			</div>
		</section>
	</div>
</Portal>
