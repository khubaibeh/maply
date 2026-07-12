<script lang="ts">
	import * as AlertDialog from "$lib/components/ui/alert-dialog";
	import { buttonVariants } from "$lib/components/ui/button";
	import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
	import { Input } from "$lib/components/ui/input";
	import { cn } from "$lib/utils";
	import { canvasCursor } from "@components/core/cursors";
	import { project as projectIo, svg as svgIo } from "@maply/io";
	import type { ProjectFilePackage } from "@maply/io/types";
	import { Editor } from "editor";
	import CaretDown from "phosphor-svelte/lib/CaretDown";
	import DotsThree from "phosphor-svelte/lib/DotsThree";

	let { class: className = "" }: { class?: string } = $props();

	const project = Editor.state.project;

	let editName = $state("");
	let isEditing = $state(false);
	let inputRef: HTMLInputElement | null = $state(null);
	let newProjectDialogOpen = $state(false);
	let importProjectDialogOpen = $state(false);
	let projectImportInputRef: HTMLInputElement | null = $state(null);
	let svgImportInputRef: HTMLInputElement | null = $state(null);
	let pendingImportedProject: ProjectFilePackage | null = null;
	let pendingImportedProjectName = $state("");
	let busy = $state<"project-import" | "project-export" | "svg-export" | null>(null);

	async function handleCreateNewProject(elements: "sample" | "blank" = "blank") {
		const result = await Editor.project.create({ elements });
		if (!result.ok) return;
		newProjectDialogOpen = false;
	}

	function sanitizeDownloadName(name: string, extension: string) {
		const baseName = name
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "");
		return `${baseName || "maply-project"}.${extension}`;
	}

	function downloadTextFile(name: string, content: string, mimeType: string) {
		const blob = new Blob([content], { type: mimeType });
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = name;
		link.click();
		URL.revokeObjectURL(url);
	}

	async function handleProjectExport() {
		if (busy) return;
		busy = "project-export";

		try {
			const projectFile = await Editor.project.export();
			if (!projectFile.ok) return;

			const serialized = await projectIo.file.serialize(projectFile.value);
			if (!serialized.ok) return;

			downloadTextFile(
				sanitizeDownloadName(projectFile.value.project.name, "json"),
				serialized.value,
				"application/json"
			);
		} catch {
			void 0;
		} finally {
			busy = null;
		}
	}

	async function handleSvgExport() {
		if (busy) return;
		busy = "svg-export";

		try {
			const svg = await Editor.project.exportSvg();
			if (!svg.ok) return;

			downloadTextFile(sanitizeDownloadName($project.name, "svg"), svg.value, "image/svg+xml");
		} catch {
			void 0;
		} finally {
			busy = null;
		}
	}

	function openProjectImportPicker() {
		projectImportInputRef?.click();
	}

	function openSvgImportPicker() {
		svgImportInputRef?.click();
	}

	async function handleProjectImportFileChange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file || busy) return;
		busy = "project-import";

		try {
			const parsed = await projectIo.file.parse(await file.text());
			if (!parsed.ok) {
				pendingImportedProject = null;
				pendingImportedProjectName = "";
				return;
			}

			pendingImportedProject = parsed.value;
			pendingImportedProjectName = file.name;
			importProjectDialogOpen = true;
		} catch {
			pendingImportedProject = null;
			pendingImportedProjectName = "";
			void 0;
		} finally {
			busy = null;
			input.value = "";
		}
	}

	async function handleSvgImportFileChange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file || busy) return;
		busy = "project-import";
		console.info("[svg-import] selected file", {
			name: file.name,
			type: file.type,
			size: file.size
		});

		try {
			const text = await file.text();
			console.info("[svg-import] read file contents", { name: file.name, length: text.length });
			const imported = await svgIo.import(text);
			if (!imported.ok) {
				pendingImportedProject = null;
				pendingImportedProjectName = "";
				console.error("[svg-import] failed before replace dialog", { name: file.name, error: imported.error });
				return;
			}

			pendingImportedProject = imported.value.file;
			pendingImportedProjectName = file.name;
			importProjectDialogOpen = true;
			console.info("[svg-import] parsed successfully, opening replace dialog", {
				name: file.name,
				elements: pendingImportedProject.project.elements.length,
				imageAssets: pendingImportedProject.imageAssets.length,
				source: imported.value.source,
				warnings: imported.value.warnings
			});
		} catch (error) {
			pendingImportedProject = null;
			pendingImportedProjectName = "";
			console.error("[svg-import] failed before replace dialog", { name: file.name, error });
		} finally {
			busy = null;
			input.value = "";
		}
	}

	async function confirmProjectImport() {
		if (!pendingImportedProject || busy) return;
		busy = "project-import";
		let imported = false;

		try {
			const result = await Editor.project.import(pendingImportedProject);
			if (!result.ok) return;

			imported = true;
			importProjectDialogOpen = false;
			pendingImportedProject = null;
			pendingImportedProjectName = "";
		} catch {
			void 0;
		} finally {
			busy = null;
		}

		if (imported) {
			window.location.reload();
		}
	}

	function cancelProjectImport() {
		importProjectDialogOpen = false;
		pendingImportedProject = null;
		pendingImportedProjectName = "";
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
		Editor.project.rename(editName);
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

<div
	class={cn(
		"canvas-default-cursor border-border/80 bg-background/72 text-foreground supports-backdrop-filter:bg-background/52 absolute z-10 flex items-center gap-2 rounded-2xl border px-3 py-2 shadow-[0_8px_30px_-18px_color-mix(in_oklab,var(--foreground)_28%,transparent)] backdrop-blur-md",
		className
	)}
	style:cursor={canvasCursor.default}
>
	<input
		bind:this={projectImportInputRef}
		type="file"
		accept="application/json,.json"
		onchange={handleProjectImportFileChange}
		class="hidden"
	/>
	<input
		bind:this={svgImportInputRef}
		type="file"
		accept="image/svg+xml,.svg"
		onchange={handleSvgImportFileChange}
		class="hidden"
	/>
	<div class="max-w-80 min-w-40 flex-1">
		{#if isEditing}
			<Input
				bind:ref={() => inputRef, (v) => (inputRef = v)}
				bind:value={editName}
				onblur={save}
				onkeydown={handleKeydown}
				class="h-6 w-full min-w-0 border-0 bg-transparent px-0 text-sm font-semibold shadow-none transition-none focus-visible:ring-0 focus-visible:ring-offset-0"
			/>
		{:else}
			<button
				type="button"
				class="hover:bg-accent/70 hover:text-foreground/90 focus-visible:ring-ring/40 block w-full truncate rounded-lg px-1 py-0.5 text-left text-sm font-semibold outline-none select-none focus-visible:ring-2"
				onclick={startEditing}
				ondblclick={startEditing}
			>
				{$project.name || "Untitled"}
			</button>
		{/if}
	</div>
	<DropdownMenu.Root>
		<DropdownMenu.Trigger
			disabled={isEditing}
			class="hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring/40 inline-flex size-8 shrink-0 items-center justify-center rounded-xl transition-colors outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-40"
			aria-label="Project actions"
		>
			<DotsThree />
		</DropdownMenu.Trigger>
		<DropdownMenu.Content
			align="start"
			side="bottom"
			sideOffset={15}
			class="canvas-default-cursor bg-popover/96 text-popover-foreground border-border supports-backdrop-filter:bg-popover/88 w-34! min-w-0! overflow-hidden rounded-xl border p-1 shadow-xl backdrop-blur-md"
			style={`cursor: ${canvasCursor.default}`}
		>
			<DropdownMenu.Group>
				<DropdownMenu.Item class="rounded-lg px-2 py-1.5 text-xs" onclick={() => (newProjectDialogOpen = true)}
					><span class="px-1">New Project</span></DropdownMenu.Item
				>
				<DropdownMenu.Separator class="m-1 my-0.5" />
				<DropdownMenu.Label
					class="text-muted-foreground px-2 py-1 text-[10px] font-semibold tracking-wide uppercase"
					>Import</DropdownMenu.Label
				>
				<DropdownMenu.Item class="rounded-lg px-2 py-1.5 text-xs" onclick={openSvgImportPicker}
					><span class="px-1">SVG</span></DropdownMenu.Item
				>
				<DropdownMenu.Item class="rounded-lg px-2 py-1.5 text-xs" onclick={openProjectImportPicker}
					><span class="px-1">Project</span></DropdownMenu.Item
				>
				<DropdownMenu.Separator class="m-1 my-0.5" />
				<DropdownMenu.Label
					class="text-muted-foreground px-2 py-1 text-[10px] font-semibold tracking-wide uppercase"
					>Export</DropdownMenu.Label
				>
				<DropdownMenu.Item class="rounded-lg px-2 py-1.5 text-xs" onclick={() => void handleSvgExport()}
					><span class="px-1">SVG</span></DropdownMenu.Item
				>
				<DropdownMenu.Item class="rounded-lg px-2 py-1.5 text-xs" onclick={handleProjectExport}
					><span class="px-1">Project</span></DropdownMenu.Item
				>
			</DropdownMenu.Group>
		</DropdownMenu.Content>
	</DropdownMenu.Root>
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
				<AlertDialog.Action class="rounded-r-none" onclick={() => handleCreateNewProject()}
					>Create</AlertDialog.Action
				>
				<DropdownMenu.Root>
					<DropdownMenu.Trigger
						class={cn(
							buttonVariants({ variant: "default", size: "default" }),
							"-ml-1 rounded-l-none px-2!"
						)}
						aria-label="Create new project options"
					>
						<CaretDown class="size-3.5" />
					</DropdownMenu.Trigger>
					<DropdownMenu.Content align="end" class="min-w-32 rounded-xl p-1">
						<DropdownMenu.Item onclick={() => handleCreateNewProject("sample")} class="text-xs">
							Sample Project
						</DropdownMenu.Item>
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			</div>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<AlertDialog.Root bind:open={importProjectDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Replace current project?</AlertDialog.Title>
			<AlertDialog.Description>
				Importing {pendingImportedProjectName || "this project file"} will replace your current project. Save the
				existing project first if you want to keep it.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel onclick={cancelProjectImport} disabled={busy === "project-import"}
				>Cancel</AlertDialog.Cancel
			>
			<AlertDialog.Action onclick={() => void confirmProjectImport()} disabled={busy === "project-import"}
				>{busy === "project-import" ? "Importing..." : "Replace project"}</AlertDialog.Action
			>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
