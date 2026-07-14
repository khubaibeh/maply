<script lang="ts">
	import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
	import { Input } from "$lib/components/ui/input";
	import { cn } from "$lib/utils";
	import { canvasCursor } from "@components/core/cursors";
	import { Editor } from "editor";
	import DotsThree from "phosphor-svelte/lib/DotsThree";

	import ImportProjectDialog from "./ImportProjectDialog.svelte";
	import NewProjectDialog from "./NewProjectDialog.svelte";
	import { createProjectTransfer } from "./project-transfer.svelte";

	let { class: className = "" }: { class?: string } = $props();
	const project = Editor.state.project;
	const transfer = createProjectTransfer();
	let editing = $state(false);
	let name = $state("");
	let input: HTMLInputElement | null = $state(null);
	let projectPicker: HTMLInputElement | null = $state(null);
	let svgPicker: HTMLInputElement | null = $state(null);
	let newProjectOpen = $state(false);

	$effect(() => {
		if (editing && input) {
			input.focus();
			input.select();
		}
		if ($project.initialized && !editing) name = $project.name;
	});

	function saveName() {
		Editor.project.rename(name);
		editing = false;
	}

	async function choose(event: Event, kind: "project" | "svg") {
		const target = event.currentTarget as HTMLInputElement;
		const file = target.files?.[0];
		if (file) await (kind === "project" ? transfer.stageProject(file) : transfer.stageSvg(file));
		target.value = "";
	}
</script>

<div
	class={cn("canvas-default-cursor absolute z-10 flex flex-col gap-1", className)}
	style:cursor={canvasCursor.default}
>
	<div
		class="border-border/80 bg-background/72 text-foreground supports-backdrop-filter:bg-background/52 flex items-center gap-2 rounded-2xl border px-3 py-2 shadow-[0_8px_30px_-18px_color-mix(in_oklab,var(--foreground)_28%,transparent)] backdrop-blur-md"
	>
		<input
			bind:this={projectPicker}
			type="file"
			accept="application/json,.json"
			onchange={(event) => void choose(event, "project")}
			class="hidden"
		/>
		<input
			bind:this={svgPicker}
			type="file"
			accept="image/svg+xml,.svg"
			onchange={(event) => void choose(event, "svg")}
			class="hidden"
		/>
		<div class="max-w-80 min-w-40 flex-1">
			{#if editing}
				<Input
					bind:ref={() => input, (value) => (input = value)}
					bind:value={name}
					onblur={saveName}
					onkeydown={(event) => {
						if (event.key === "Enter") saveName();
						if (event.key === "Escape") editing = false;
					}}
					class="h-6 w-full min-w-0 border-0 bg-transparent px-0 text-sm font-semibold shadow-none transition-none focus-visible:ring-0 focus-visible:ring-offset-0"
				/>
			{:else}
				<button
					type="button"
					class="hover:bg-accent/70 focus-visible:ring-ring/40 block w-full truncate rounded-lg px-1 py-0.5 text-left text-sm font-semibold outline-none select-none focus-visible:ring-2"
					onclick={() => {
						name = $project.name;
						editing = true;
					}}>{$project.name || "Untitled"}</button
				>
			{/if}
		</div>
		<DropdownMenu.Root>
			<DropdownMenu.Trigger
				disabled={editing}
				class="hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring/40 inline-flex size-8 shrink-0 items-center justify-center rounded-xl outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-40"
				aria-label="Project actions"><DotsThree /></DropdownMenu.Trigger
			>
			<DropdownMenu.Content
				align="start"
				side="bottom"
				sideOffset={15}
				class="canvas-default-cursor bg-popover/96 text-popover-foreground border-border supports-backdrop-filter:bg-popover/88 w-34! min-w-0! rounded-xl border p-1 shadow-xl backdrop-blur-md"
				style={`cursor: ${canvasCursor.default}`}
			>
				<DropdownMenu.Group>
					<DropdownMenu.Item class="rounded-lg px-2 py-1.5 text-xs" onclick={() => (newProjectOpen = true)}
						>New Project</DropdownMenu.Item
					>
				</DropdownMenu.Group>
				<DropdownMenu.Separator />
				<DropdownMenu.Group>
					<DropdownMenu.Label
						class="text-muted-foreground px-2 py-1 text-[10px] font-semibold tracking-wide uppercase"
						>Import</DropdownMenu.Label
					>
					<DropdownMenu.Item class="rounded-lg px-2 py-1.5 text-xs" onclick={() => svgPicker?.click()}
						>SVG</DropdownMenu.Item
					>
					<DropdownMenu.Item class="rounded-lg px-2 py-1.5 text-xs" onclick={() => projectPicker?.click()}
						>Project</DropdownMenu.Item
					>
				</DropdownMenu.Group>
				<DropdownMenu.Separator />
				<DropdownMenu.Group>
					<DropdownMenu.Label
						class="text-muted-foreground px-2 py-1 text-[10px] font-semibold tracking-wide uppercase"
						>Export</DropdownMenu.Label
					>
					<DropdownMenu.Item class="rounded-lg px-2 py-1.5 text-xs" onclick={() => void transfer.exportSvg()}
						>SVG</DropdownMenu.Item
					>
					<DropdownMenu.Item
						class="rounded-lg px-2 py-1.5 text-xs"
						onclick={() => void transfer.exportProject()}>Project</DropdownMenu.Item
					>
				</DropdownMenu.Group>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</div>
	<!-- {#if transfer.state.error}<p
		role="alert"
		class="bg-destructive max-w-72 rounded-xl px-3 py-2 text-xs text-white shadow-lg"
	>
		{transfer.state.error}
	</p>{/if} -->
</div>

<NewProjectDialog bind:open={newProjectOpen} onError={(message) => (transfer.state.error = message)} />
<ImportProjectDialog
	bind:open={transfer.state.importOpen}
	name={transfer.state.pendingName}
	busy={transfer.state.busy === "project-import"}
	source={transfer.state.source}
	warnings={transfer.state.warnings}
	onCancel={transfer.cancelImport}
	onConfirm={() => void transfer.confirmImport()}
/>
