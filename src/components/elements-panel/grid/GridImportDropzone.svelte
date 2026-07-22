<script lang="ts">
	import UploadIcon from "phosphor-svelte/lib/Upload";

	import type { IngestWarning } from "./ingest/types";
	import type { Grid } from "./use-grid.svelte";

	interface Props {
		grid?: Grid;
		onImport?: (warnings: IngestWarning[]) => void;
	}

	let { grid, onImport }: Props = $props();
	let isDragging = $state(false);
	let fileInput: HTMLInputElement | null = $state(null);
	let errorMessage = $state<string | null>(null);

	async function handleFiles(files: FileList | null) {
		if (!files || files.length === 0 || !grid) return;

		errorMessage = null;
		const file = files[0]; // Only handle first file

		try {
			const result = await grid.handleImportFile(file);
			onImport?.(result.warnings);
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : "Failed to import file";
		}
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		isDragging = true;
	}

	function handleDragLeave() {
		isDragging = false;
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		isDragging = false;
		void handleFiles(event.dataTransfer?.files ?? null);
	}

	function handleFileChange(event: Event) {
		const input = event.target as HTMLInputElement;
		void handleFiles(input.files);
	}

	function triggerFileInput() {
		fileInput?.click();
	}
</script>

<div
	class="border-border/50 rounded-lg border-2 border-dashed p-8 text-center transition-colors {isDragging
		? 'bg-accent/20 border-accent'
		: 'hover:bg-accent/10 hover:border-accent/50'}"
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
	role="button"
	tabindex="0"
	onclick={triggerFileInput}
	onkeydown={(e) => e.key === "Enter" && triggerFileInput()}
>
	<UploadIcon class="text-muted-foreground mx-auto mb-2 size-8" />
	<p class="text-foreground mb-1 text-sm font-medium">Drop file here or click to browse</p>
	<p class="text-muted-foreground text-xs">Supports CSV, TSV, and Excel (.xlsx)</p>

	<input
		bind:this={fileInput}
		type="file"
		class="hidden"
		accept=".csv,.tsv,.txt,.xlsx,.xls"
		onchange={handleFileChange}
	/>
</div>

{#if errorMessage}
	<div class="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">
		{errorMessage}
	</div>
{/if}
