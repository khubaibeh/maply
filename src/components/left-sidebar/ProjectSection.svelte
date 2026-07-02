<script lang="ts">
	import * as AlertDialog from "$lib/components/ui/alert-dialog";
	import { Button, buttonVariants } from "$lib/components/ui/button";
	import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
	import { Input } from "$lib/components/ui/input";
	import { App } from "@app";
	import CaretDown from "phosphor-svelte/lib/CaretDown";
	import FloppyDisk from "phosphor-svelte/lib/FloppyDisk";
	import Pencil from "phosphor-svelte/lib/Pencil";
	import Plus from "phosphor-svelte/lib/Plus";

	const project = App.state.project;

	let editName = $state("");
	let isEditing = $state(false);
	let inputRef: HTMLInputElement | null = $state(null);
	let newProjectDialogOpen = $state(false);

	async function handleCreateNewProject(elements: "sample" | "blank" = "blank") {
		await App.project.create({ elements });
		newProjectDialogOpen = false;
	}

	async function handleSave() {
		await App.save.flush();
	}

	$effect(() => {
		if (isEditing && inputRef) {
			inputRef.focus();
			inputRef.select();
		}
	});

	$effect(() => {
		if (!$project.initialized) return;
		if (isEditing) return;
		editName = $project.name;
	});

	function startEditing() {
		editName = $project.name;
		isEditing = true;
	}

	function save() {
		App.actions.project.setName(editName);
		isEditing = false;
	}

	function cancel() {
		editName = $project.name;
		isEditing = false;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === "Enter") {
			save();
		} else if (event.key === "Escape") {
			cancel();
		}
	}
</script>

<div class="border-border border-b p-3">
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
				{$project.name}
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
				<FloppyDisk />
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
</div>

<AlertDialog.Root bind:open={newProjectDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Create new project?</AlertDialog.Title>
			<AlertDialog.Description>
				This will delete your current project and create a fresh blank canvas unless you pick Sample Project.
				This action cannot be undone.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel onclick={() => (newProjectDialogOpen = false)}>Cancel</AlertDialog.Cancel>
			<div class="flex items-center">
				<AlertDialog.Action class="rounded-r-none" onclick={() => handleCreateNewProject()}>
					Create
				</AlertDialog.Action>
				<DropdownMenu.Root>
					<DropdownMenu.Trigger
						class="{buttonVariants({
							variant: 'default',
							size: 'default'
						})} border-primary-foreground/20 -ml-1 rounded-l-none border-l px-1!"
						aria-label="Create new project options"
					>
						<CaretDown />
					</DropdownMenu.Trigger>
					<DropdownMenu.Content align="end">
						<DropdownMenu.Item onclick={() => handleCreateNewProject("sample")} class="text-xs">
							Sample Project
						</DropdownMenu.Item>
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			</div>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
