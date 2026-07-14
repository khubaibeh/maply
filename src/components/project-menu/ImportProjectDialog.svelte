<script lang="ts">
	import * as AlertDialog from "$lib/components/ui/alert-dialog";
	import { canvasCursor } from "@components/core/cursors";

	type Props = {
		open?: boolean;
		name: string;
		busy: boolean;
		source: "generic" | "recovery" | "synoptic" | null;
		warnings: string[];
		onCancel: () => void;
		onConfirm: () => void;
	};

	let { open = $bindable(false), name, busy, source, warnings, onCancel, onConfirm }: Props = $props();
	let actionButton: HTMLButtonElement | null = $state(null);
	let wasBusy = false;

	$effect(() => {
		if (busy) {
			wasBusy = true;
			return;
		}
		if (!wasBusy || !actionButton) return;

		wasBusy = false;
		const button = actionButton;
		button.style.cursor = "auto";
		void button.offsetWidth;
		const frame = requestAnimationFrame(() => {
			if (button.isConnected) button.style.cursor = canvasCursor.default;
		});

		return () => cancelAnimationFrame(frame);
	});
</script>

<AlertDialog.Root bind:open>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Replace current project?</AlertDialog.Title>
			<AlertDialog.Description
				>Importing {name || "this project file"} will replace the current project.</AlertDialog.Description
			>
			{#if source}
				<p class="text-muted-foreground text-sm">
					SVG parser: {source}. Imported with {warnings.length} warning{warnings.length === 1 ? "" : "s"}.
				</p>
			{/if}
			{#if warnings.length > 0}
				<ul class="text-muted-foreground max-h-32 list-disc overflow-auto pl-5 text-sm">
					{#each warnings as warning, index (index)}<li>{warning}</li>{/each}
				</ul>
			{/if}
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel onclick={onCancel} disabled={busy}>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action
				bind:ref={() => actionButton, (value) => (actionButton = value)}
				onclick={onConfirm}
				disabled={busy}>{busy ? "Importing..." : "Replace project"}</AlertDialog.Action
			>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
