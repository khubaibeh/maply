<script lang="ts">
	import { duplicateElement } from "$lib/app/core/element-actions";
	import type { Element } from "$lib/app/domain/elements";
	import { copyElement, getClipboardElement } from "$lib/app/state/clipboard.svelte";
	import { projectState } from "$lib/app/state/project.svelte";
	import * as AlertDialog from "$lib/components/ui/alert-dialog";
	import { Button, buttonVariants } from "$lib/components/ui/button";
	import * as Collapsible from "$lib/components/ui/collapsible";
	import * as ContextMenu from "$lib/components/ui/context-menu";
	import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
	import { Input } from "$lib/components/ui/input";
	import { ScrollArea } from "$lib/components/ui/scroll-area";
	import ChevronDown from "@lucide/svelte/icons/chevron-down";
	import Circle from "@lucide/svelte/icons/circle";
	import Download from "@lucide/svelte/icons/download";
	import Image from "@lucide/svelte/icons/image";
	import Pencil from "@lucide/svelte/icons/pencil";
	import Plus from "@lucide/svelte/icons/plus";
	import Save from "@lucide/svelte/icons/save";
	import Square from "@lucide/svelte/icons/square";
	import Trash2 from "@lucide/svelte/icons/trash-2";
	import Type from "@lucide/svelte/icons/type";
	import Upload from "@lucide/svelte/icons/upload";
	import type { Component } from "svelte";

	let editName = $state("");
	let isEditing = $state(false);
	let inputRef: HTMLInputElement | null = $state(null);
	let importsOpen = $state(true);
	let elementsOpen = $state(true);
	let newProjectDialogOpen = $state(false);
	let editingElementId = $state<string | null>(null);
	let editingElementName = $state("");
	let editingElementInputRef: HTMLInputElement | null = $state(null);

	const hasClipboardElement = $derived(!!getClipboardElement());

	const elementIcons: Record<Element["type"], Component> = {
		rect: Square,
		circle: Circle,
		path: Pencil,
		text: Type,
		image: Image
	};

	async function handleCreateNewProject() {
		await projectState.createNewProject();
		newProjectDialogOpen = false;
	}

	async function handleSave() {
		await projectState.saveNow();
	}

	$effect(() => {
		if (isEditing && inputRef) {
			inputRef.focus();
			inputRef.select();
		}
	});

	function startEditing() {
		editName = $projectState.name;
		isEditing = true;
	}

	function save() {
		projectState.setName(editName);
		isEditing = false;
	}

	function cancel() {
		editName = $projectState.name;
		isEditing = false;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === "Enter") {
			save();
		} else if (event.key === "Escape") {
			cancel();
		}
	}

	function startEditingElement(element: Element) {
		editingElementId = element.id;
		editingElementName = element.name;
	}

	function saveElementEdit() {
		const trimmed = editingElementName.trim();
		if (editingElementId && trimmed) {
			projectState.renameElement(editingElementId, trimmed);
		}
		editingElementId = null;
	}

	function cancelElementEdit() {
		editingElementId = null;
	}

	function handleElementEditKeydown(event: KeyboardEvent) {
		if (event.key === "Enter") {
			saveElementEdit();
		} else if (event.key === "Escape") {
			cancelElementEdit();
		}
	}

	function handleElementTreeBackgroundPointerDown(event: PointerEvent) {
		if (event.target !== event.currentTarget) return;
		projectState.selectElement(null);
	}

	$effect(() => {
		if (editingElementId && editingElementInputRef) {
			editingElementInputRef.focus();
			editingElementInputRef.select();
		}
	});

	$effect(() => {
		if (!$projectState.initialized) return;
		// Do not overwrite the local draft while the project name input is active.
		if (isEditing) return;
		editName = $projectState.name;
		importsOpen = $projectState.importExportState.importsOpen;
		elementsOpen = $projectState.importExportState.elementsOpen;
	});

	$effect(() => {
		if (!$projectState.initialized) return;
		// Collapsible state is part of the persisted project UI state.
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
				class="text-sidebar-foreground truncate text-sm font-semibold"
				ondblclick={startEditing}
				role="button"
				tabindex="0"
			>
				{$projectState.name}
			</span>
		{/if}
		<div class="flex items-center gap-x-1">
			<Button
				variant="ghost"
				size="icon-sm"
				class="text-sidebar-foreground/70 hover:text-sidebar-foreground size-6 shrink-0 rounded-md transition-opacity duration-150 {isEditing
					? 'pointer-events-none opacity-0'
					: 'opacity-100'}"
				onclick={startEditing}
				aria-label="Rename project"
			>
				<Pencil />
			</Button>
			<Button
				variant="ghost"
				size="icon-sm"
				class="text-sidebar-foreground/70 hover:text-sidebar-foreground size-6 shrink-0 rounded-md transition-opacity duration-150 {isEditing
					? 'pointer-events-none opacity-0'
					: 'opacity-100'}"
				onclick={handleSave}
				aria-label="Save project"
			>
				<Save />
			</Button>
			<Button
				variant="ghost"
				size="icon-sm"
				class="text-sidebar-foreground/70 hover:text-sidebar-foreground size-6 shrink-0 rounded-md transition-opacity duration-150 {isEditing
					? 'pointer-events-none opacity-0'
					: 'opacity-100'}"
				onclick={() => (newProjectDialogOpen = true)}
				aria-label="Create new project"
			>
				<Plus />
			</Button>
		</div>
	</div>
{/snippet}

{#snippet sectionImports()}
	<Collapsible.Root bind:open={importsOpen}>
		<Collapsible.Trigger
			class="border-border hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex h-8 w-full shrink-0 items-center justify-between border-b px-3 text-left outline-none"
		>
			<span class="text-sidebar-foreground/80 text-xs font-semibold tracking-wide uppercase">
				Import / Export
			</span>
			<ChevronDown
				class="text-sidebar-foreground/70 size-4 transition-transform duration-200 {importsOpen
					? 'rotate-180'
					: ''}"
			/>
		</Collapsible.Trigger>
		<Collapsible.Content class="sidebar-collapsible-content">
			<div class="flex flex-col items-center gap-1.5 p-3">
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
						<DropdownMenu.Item class="justify-center text-center text-xs">Project</DropdownMenu.Item>
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
						<DropdownMenu.Item class="justify-center text-center text-xs">Project</DropdownMenu.Item>
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			</div>
		</Collapsible.Content>
	</Collapsible.Root>
{/snippet}

<!-- The tree has item-level menus plus a background menu for paste into empty space. -->
{#snippet sectionElements()}
	<Collapsible.Root bind:open={elementsOpen} class="flex min-h-0 flex-1 flex-col">
		<Collapsible.Trigger
			class="border-border hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex h-8 w-full shrink-0 items-center justify-between border-b px-3 text-left outline-none"
		>
			<span class="text-sidebar-foreground/80 text-xs font-semibold tracking-wide uppercase"> Elements </span>
			<ChevronDown
				class="text-sidebar-foreground/70 size-4 transition-transform duration-200 {elementsOpen
					? 'rotate-180'
					: ''}"
			/>
		</Collapsible.Trigger>
		<Collapsible.Content class="sidebar-collapsible-content flex flex-col">
			<div class="flex min-h-0 flex-1 flex-col">
				<ContextMenu.Root>
					<ContextMenu.Trigger class="flex flex-1 flex-col">
						<ScrollArea class="flex-1">
							<div
								class="flex min-h-full flex-col gap-0.5 p-2"
								onpointerdown={handleElementTreeBackgroundPointerDown}
								role="presentation"
							>
								{#each $projectState.elements as element (element.id)}
									{@const Icon = elementIcons[element.type]}
									{@const isSelected = $projectState.selectedElementId === element.id}
									{@const isEditingElement = editingElementId === element.id}
									{#if isEditingElement}
										<div
											class="bg-sidebar-accent flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs"
										>
											<Icon class="text-muted-foreground size-4 shrink-0" />
											<Input
												bind:ref={
													() => editingElementInputRef, (v) => (editingElementInputRef = v)
												}
												bind:value={editingElementName}
												onblur={saveElementEdit}
												onkeydown={handleElementEditKeydown}
												class="h-6 flex-1 border-0 bg-transparent px-0 py-0 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
											/>
										</div>
									{:else}
										<ContextMenu.Root>
											<ContextMenu.Trigger class="contents">
												<div
													class="group flex w-full items-center rounded-lg {isSelected
														? 'bg-sidebar-accent text-sidebar-accent-foreground'
														: 'text-sidebar-foreground hover:bg-sidebar-accent/50'}"
												>
													<button
														type="button"
														class="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-xs outline-none select-none"
														onclick={() => projectState.selectElement(element.id)}
														ondblclick={() => startEditingElement(element)}
													>
														<Icon class="text-muted-foreground size-3 shrink-0" />
														<span class="truncate" title={element.name}>{element.name}</span
														>
													</button>
													<button
														type="button"
														class="text-sidebar-foreground/60 hover:text-destructive px-2 py-1.5 opacity-0 transition-opacity duration-150 outline-none group-hover:opacity-100 focus-visible:opacity-100"
														onclick={(event) => {
															event.stopPropagation();
															projectState.deleteElement(element.id);
														}}
														aria-label="Delete {element.name}"
													>
														<Trash2 class="size-3.5" />
													</button>
												</div>
											</ContextMenu.Trigger>
											<ContextMenu.Content>
												<ContextMenu.Item onclick={() => copyElement(element)}>
													Copy
												</ContextMenu.Item>
												<ContextMenu.Item
													variant="destructive"
													onclick={() => projectState.deleteElement(element.id)}
												>
													Delete
												</ContextMenu.Item>
											</ContextMenu.Content>
										</ContextMenu.Root>
									{/if}
								{:else}
									<p class="text-muted-foreground px-2 py-1 text-xs">No elements</p>
								{/each}
							</div>
						</ScrollArea>
					</ContextMenu.Trigger>
					<ContextMenu.Content>
						<ContextMenu.Item
							disabled={!hasClipboardElement}
							onclick={() => {
								const copied = getClipboardElement();
								if (!copied) return;
								projectState.addElement(duplicateElement(copied));
							}}
						>
							Paste
						</ContextMenu.Item>
					</ContextMenu.Content>
				</ContextMenu.Root>
			</div>
		</Collapsible.Content>
	</Collapsible.Root>
{/snippet}

<aside class="border-border bg-sidebar flex w-60 shrink-0 flex-col border-r">
	<div class="border-border border-b p-3">
		{@render sectionProject()}
	</div>

	<div class={`flex flex-col ${importsOpen ? "border-border border-b" : ""} `}>
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
				This will delete your current project and create a fresh one from the default settings. This action
				cannot be undone.
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

	:global(.sidebar-collapsible-content[data-state="open"]) {
		animation: sidebar-collapse-down 200ms ease-out;
	}

	:global(.sidebar-collapsible-content[data-state="closed"]) {
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
