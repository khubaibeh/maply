<script lang="ts">
	import { downloadName, downloadText } from "$lib/browser-download";
	import { Button } from "$lib/components/ui/button";
	import * as Collapsible from "$lib/components/ui/collapsible";
	import { Portal } from "bits-ui";
	import { Editor } from "editor";
	import CaretDown from "phosphor-svelte/lib/CaretDown";
	import DownloadSimpleIcon from "phosphor-svelte/lib/DownloadSimple";
	import FunnelXIcon from "phosphor-svelte/lib/FunnelXIcon";
	import GridNineIcon from "phosphor-svelte/lib/GridNineIcon";
	import TrashIcon from "phosphor-svelte/lib/Trash";
	import XIcon from "phosphor-svelte/lib/XIcon";

	import { elementsByNameRow } from "./grid/element-bindings";
	import { nameMappingsCsv } from "./grid/grid-export";
	import GridEditor from "./grid/GridEditor.svelte";
	import GridImportDropzone from "./grid/GridImportDropzone.svelte";
	import type { IngestWarning } from "./grid/ingest/types";
	import { loadNameGrid, saveNameGrid } from "./grid/name-grid-state";
	import { createGrid } from "./grid/use-grid.svelte";

	interface Props {
		onClose: () => void;
	}

	let { onClose }: Props = $props();
	const project = Editor.state.project;
	const grid = createGrid({
		data: loadNameGrid($project.id),
		onChange: (data) => saveNameGrid($project.id, data)
	});
	let warnings = $state<IngestWarning[]>([]);
	let gridError = $state<string | null>(null);
	let importOpen = $state(true);
	const rowElements = $derived(elementsByNameRow(grid.rows, $project.elements));
	const onlyNameColumnSelected = $derived(
		grid.headerSel?.kind === "col" && grid.headerSel.indices.size === 1 && grid.headerSel.indices.has(0)
	);

	function downloadMappings() {
		downloadText(
			downloadName(`${$project.name || "maply-project"}-element-names`, "csv"),
			nameMappingsCsv(grid.headers, grid.rows, rowElements),
			"text/csv;charset=utf-8"
		);
	}
</script>

<Portal to="body">
	<div
		class="bg-background/20 fixed inset-0 z-50 flex items-center justify-center p-10 backdrop-blur-[2px]"
		role="dialog"
		tabindex="-1"
		aria-modal="true"
		aria-labelledby="import-names-title"
		onkeydown={(event) => {
			if (event.defaultPrevented) return;
			if (event.key === "Escape") {
				event.preventDefault();
				onClose();
			}
		}}
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
				<Collapsible.Root bind:open={importOpen}>
					<Collapsible.Trigger
						class="text-foreground hover:text-muted-foreground flex w-full cursor-pointer items-center justify-between text-sm font-medium"
					>
						Import Data
						<CaretDown class="size-4 transition-transform {importOpen ? 'rotate-180' : ''}" />
					</Collapsible.Trigger>
					<Collapsible.Content class="mt-3 flex flex-col gap-3">
						<GridImportDropzone {grid} onImport={(importWarnings) => (warnings = importWarnings)} />

						{#if warnings.length > 0}
							<div class="bg-warning/10 text-warning rounded-lg p-3 text-sm">
								<p class="mb-1 font-medium">Import warnings</p>
								<ul class="list-inside list-disc">
									{#each warnings as warning (`${warning.type}:${warning.message}`)}
										<li>{warning.message}</li>
									{/each}
								</ul>
							</div>
						{/if}
					</Collapsible.Content>
				</Collapsible.Root>

				<div class="flex min-h-0 flex-1 flex-col">
					<div class="mb-3 flex min-h-8 items-center justify-between">
						<h3 class="text-sm font-medium">Edit Names</h3>
						<div class="flex items-center gap-2">
							<Button variant="outline" size="xs" onclick={downloadMappings}>
								<DownloadSimpleIcon data-icon="inline-start" />
								Download
							</Button>
							{#if grid.hasFilters}
								<Button
									variant="outline"
									size="xs"
									class="flex items-center gap-1"
									onclick={() => grid.clearFilters()}
								>
									<FunnelXIcon data-icon="inline-start" />
									Clear filters
								</Button>
							{/if}
							{#if grid.headerSel}
								<Button
									data-grid-selection-action
									size="xs"
									variant="destructive"
									onclick={() => grid.deleteSelected()}
									class="flex items-center gap-1"
									disabled={onlyNameColumnSelected}
									title={onlyNameColumnSelected ? "The Name column cannot be deleted" : undefined}
								>
									<TrashIcon data-icon="inline-start" />
									Delete {grid.headerSel.kind === "row" ? "Rows" : "Columns"}
								</Button>
							{/if}
						</div>
					</div>
					{#if gridError}
						<div class="bg-destructive/10 text-destructive mb-3 rounded-lg p-3 text-sm" role="alert">
							{gridError}
						</div>
					{/if}
					<GridEditor {grid} elements={$project.elements} onError={(message) => (gridError = message)} />
				</div>
			</div>
		</section>
	</div>
</Portal>
