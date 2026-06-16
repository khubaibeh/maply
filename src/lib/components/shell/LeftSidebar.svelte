<script lang="ts">
	import * as Collapsible from '$lib/components/ui/collapsible';
	import { ScrollArea } from '$lib/components/ui/scroll-area';
	import { Input } from '$lib/components/ui/input';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { projectState } from '$lib/state/project.svelte';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Plus from '@lucide/svelte/icons/plus';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Upload from '@lucide/svelte/icons/upload';
	import Download from '@lucide/svelte/icons/download';

	let editName = $state(projectState.name);
	let isEditing = $state(false);
	let inputRef: HTMLInputElement | null = $state(null);
	let importsOpen = $state(projectState.importExportState.importsOpen);
	let elementsOpen = $state(projectState.importExportState.elementsOpen);
	let newProjectDialogOpen = $state(false);

	async function handleCreateNewProject() {
		await projectState.createNewProject();
		newProjectDialogOpen = false;
	}

	$effect(() => {
		if (isEditing && inputRef) {
			inputRef.focus();
			inputRef.select();
		}
	});

	function startEditing() {
		editName = projectState.name;
		isEditing = true;
	}

	function save() {
		projectState.setName(editName);
		isEditing = false;
	}

	function cancel() {
		editName = projectState.name;
		isEditing = false;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			save();
		} else if (event.key === 'Escape') {
			cancel();
		}
	}

	$effect(() => {
		if (!projectState.initialized) return;
		if (isEditing) return;
		editName = projectState.name;
		importsOpen = projectState.importExportState.importsOpen;
		elementsOpen = projectState.importExportState.elementsOpen;
	});

	$effect(() => {
		if (!projectState.initialized) return;
		projectState.setImportExportState({ importsOpen, elementsOpen });
	});
</script>

{#snippet sectionProject()}
	<div class="flex h-7 items-center justify-between gap-2">
		{#if isEditing}
			<Input
				bind:ref={() => inputRef, (v) => (inputRef = v)}
				bind:value={editName}
				class="h-7 flex-1 border-0 bg-transparent px-0 text-sm font-semibold shadow-none transition-none focus-visible:ring-0 focus-visible:ring-offset-0"
				onblur={save}
				onkeydown={handleKeydown}
			/>
		{:else}
			<span
				class="truncate text-sm font-semibold text-sidebar-foreground"
				ondblclick={startEditing}
				role="button"
				tabindex="0"
			>
				{projectState.name}
			</span>
		{/if}
		<div class="flex items-center gap-0.5">
			<Button
				variant="ghost"
				size="icon-xs"
				class="size-6 shrink-0 rounded-md text-sidebar-foreground/70 transition-opacity duration-150 hover:text-sidebar-foreground {isEditing
					? 'pointer-events-none opacity-0'
					: 'opacity-100'}"
				onclick={startEditing}
			>
				<Pencil />
			</Button>
			<Button
				variant="ghost"
				size="icon-xs"
				class="size-6 shrink-0 rounded-md text-sidebar-foreground/70 transition-opacity duration-150 hover:text-sidebar-foreground {isEditing
					? 'pointer-events-none opacity-0'
					: 'opacity-100'}"
				onclick={() => (newProjectDialogOpen = true)}
			>
				<Plus />
			</Button>
		</div>
	</div>
{/snippet}

{#snippet sectionImports()}
	<Collapsible.Root bind:open={importsOpen}>
		<Collapsible.Trigger
			class="flex h-8 w-full shrink-0 items-center justify-between border-b border-border px-3 text-left outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
		>
			<span class="text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/80">
				Import / Export
			</span>
			<ChevronDown
				class="size-4 text-sidebar-foreground/70 transition-transform duration-200 {importsOpen
					? 'rotate-180'
					: ''}"
			/>
		</Collapsible.Trigger>
		<Collapsible.Content class="sidebar-collapsible-content">
			<div class="flex flex-col gap-1.5 p-3 items-center">
				<DropdownMenu.Root>
					<DropdownMenu.Trigger
						class="{buttonVariants({
							variant: 'secondary',
							size: 'sm'
						})} h-7 w-32 justify-center gap-1.5 px-2 text-xs"
					>
						<Upload data-icon="inline-start" class="size-3" />
						Import
					</DropdownMenu.Trigger>
					<DropdownMenu.Content class="min-w-32">
						<DropdownMenu.Item class="justify-center text-center text-xs">SVG</DropdownMenu.Item>
						<DropdownMenu.Item class="justify-center text-center text-xs">Project</DropdownMenu.Item
						>
					</DropdownMenu.Content>
				</DropdownMenu.Root>

				<DropdownMenu.Root>
					<DropdownMenu.Trigger
						class="{buttonVariants({
							variant: 'secondary',
							size: 'sm'
						})} h-7 w-32 justify-center gap-1.5 px-2 text-xs"
					>
						<Download data-icon="inline-start" class="size-3" />
						Export
					</DropdownMenu.Trigger>
					<DropdownMenu.Content class="min-w-32">
						<DropdownMenu.Item class="justify-center text-center text-xs">SVG</DropdownMenu.Item>
						<DropdownMenu.Item class="justify-center text-center text-xs">Project</DropdownMenu.Item
						>
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			</div>
		</Collapsible.Content>
	</Collapsible.Root>
{/snippet}

{#snippet sectionElements()}
	<Collapsible.Root bind:open={elementsOpen}>
		<Collapsible.Trigger
			class="flex h-8 w-full shrink-0 items-center justify-between border-b border-border px-3 text-left outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
		>
			<span class="text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/80">
				Elements
			</span>
			<ChevronDown
				class="size-4 text-sidebar-foreground/70 transition-transform duration-200 {elementsOpen
					? 'rotate-180'
					: ''}"
			/>
		</Collapsible.Trigger>
		<Collapsible.Content class="sidebar-collapsible-content">
			<ScrollArea class="min-h-0 flex-1">
				<div class="p-2">
					<p class="text-xs text-muted-foreground">No elements</p>
				</div>
			</ScrollArea>
		</Collapsible.Content>
	</Collapsible.Root>
{/snippet}

<aside class="flex w-60 shrink-0 flex-col border-r border-border bg-sidebar">
	<div class="border-b border-border p-3">
		{@render sectionProject()}
	</div>

	<div class={`flex flex-col ${importsOpen ? 'border-b border-border' : ''} `}>
		{@render sectionImports()}
	</div>

	<div class="flex min-h-0 flex-1 flex-col">
		{@render sectionElements()}
	</div>
</aside>

<AlertDialog.Root bind:open={newProjectDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Create new project?</AlertDialog.Title>
			<AlertDialog.Description>
				This will delete your current project and create a fresh one from the default settings. This
				action cannot be undone.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel onclick={() => (newProjectDialogOpen = false)}>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action onclick={handleCreateNewProject}>Create</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<style>
	:global(.sidebar-collapsible-content) {
		overflow: hidden;
	}

	:global(.sidebar-collapsible-content[data-state='open']) {
		animation: sidebar-collapse-down 200ms ease-out;
	}

	:global(.sidebar-collapsible-content[data-state='closed']) {
		animation: sidebar-collapse-up 200ms ease-out;
	}

	@keyframes sidebar-collapse-down {
		from {
			height: 0;
			opacity: 0;
		}
		to {
			height: var(--bits-collapsible-content-height);
			opacity: 1;
		}
	}

	@keyframes sidebar-collapse-up {
		from {
			height: var(--bits-collapsible-content-height);
			opacity: 1;
		}
		to {
			height: 0;
			opacity: 0;
		}
	}
</style>
