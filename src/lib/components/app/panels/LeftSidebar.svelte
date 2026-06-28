<script lang="ts">
	import * as AlertDialog from "$lib/components/ui/alert-dialog";
	import { Button, buttonVariants } from "$lib/components/ui/button";
	import * as Collapsible from "$lib/components/ui/collapsible";
	import * as ContextMenu from "$lib/components/ui/context-menu";
	import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
	import { Input } from "$lib/components/ui/input";
	import { ScrollArea } from "$lib/components/ui/scroll-area";
	import { App } from "@app";
	import type { Element, ProjectFilePackage } from "@app/types";
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
	import { onDestroy } from "svelte";
	import type { Component } from "svelte";

	import ElementNameValidation from "./ElementNameValidation.svelte";

	const project = App.state.project;

	let { width = 240 }: { width?: number } = $props();

	let editName = $state("");
	let isEditing = $state(false);
	let inputRef: HTMLInputElement | null = $state(null);
	let importsOpen = $state(true);
	let elementsOpen = $state(true);
	let newProjectDialogOpen = $state(false);
	let importProjectDialogOpen = $state(false);
	let editingElementId = $state<string | null>(null);
	let editingElementName = $state("");
	let editingElementInputRef: HTMLInputElement | null = $state(null);
	let elementListRef: HTMLDivElement | null = $state(null);
	let elementScrollViewport: HTMLElement | null = $state(null);
	let reorderState = $state<{
		elementId: string;
		fromSidebarIndex: number;
		insertionIndex: number;
		lastClientY: number;
	} | null>(null);
	let pendingReorderState: {
		elementId: string;
		fromSidebarIndex: number;
		lastClientY: number;
		timer: ReturnType<typeof setTimeout>;
	} | null = null;
	let openElementContextMenuId: string | null = $state(null);
	let autoScrollFrame: number | null = null;
	let autoScrollVelocity = 0;
	let suppressNextElementClick = false;
	let projectImportInputRef: HTMLInputElement | null = $state(null);
	let pendingImportedProject: ProjectFilePackage | null = null;
	let pendingImportedProjectName = $state("");
	let importExportFeedback = $state<{ tone: "success" | "error"; text: string } | null>(null);
	let importExportBusy = $state<"project-import" | "project-export" | "svg-export" | null>(null);
	let importExportFeedbackTimer: ReturnType<typeof setTimeout> | null = null;

	const REORDER_HOLD_DELAY_MS = 220;

	const hasClipboardElement = $derived(!!App.actions.clipboard.get());
	const elementNameValidations = $derived(App.validate.elementNames($project.elements));
	const sidebarElements = $derived(() => {
		const elements = [...$project.elements].reverse();
		const activeReorder = reorderState;
		if (!activeReorder) return elements;

		const fromIndex = elements.findIndex((element) => element.id === activeReorder.elementId);
		if (fromIndex === -1) return elements;

		const previewElements = [...elements];
		const [movedElement] = previewElements.splice(fromIndex, 1);
		previewElements.splice(activeReorder.insertionIndex, 0, movedElement);
		return previewElements;
	});

	const elementIcons: Record<Element["type"], Component> = {
		rect: Square,
		circle: Circle,
		path: Pencil,
		text: Type,
		image: Image
	};

	async function handleCreateNewProject(elements: "sample" | "blank" = "sample") {
		await App.project.create({ elements });
		newProjectDialogOpen = false;
	}

	async function handleSave() {
		await App.save.flush();
	}

	function setImportExportFeedback(tone: "success" | "error", text: string) {
		if (importExportFeedbackTimer) {
			clearTimeout(importExportFeedbackTimer);
			importExportFeedbackTimer = null;
		}

		importExportFeedback = { tone, text };
		importExportFeedbackTimer = setTimeout(() => {
			importExportFeedback = null;
			importExportFeedbackTimer = null;
		}, 4000);
	}

	function formatImportExportError(error: unknown, fallback: string) {
		const message = error instanceof Error ? error.message : fallback;

		if (/not valid json/i.test(message)) return "This file is not valid JSON.";
		if (/unsupported project file format/i.test(message)) return "This file is not a Maply project export.";
		if (/unsupported project file version/i.test(message)) return "This project file uses an unsupported version.";
		if (/missing image asset data/i.test(message)) {
			return "This project file is incomplete because one or more image assets are missing.";
		}
		if (/duplicate image asset id/i.test(message)) {
			return "This project file is invalid because it contains duplicate image assets.";
		}

		return message;
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

	function handleProjectExport() {
		if (importExportBusy) return;
		importExportBusy = "project-export";
		importExportFeedback = null;

		try {
			const projectFile = App.project.export();
			downloadTextFile(
				sanitizeDownloadName(projectFile.project.name, "json"),
				App.codec.project.stringify(projectFile),
				"application/json"
			);
			setImportExportFeedback("success", "Project exported as a portable JSON file.");
		} catch (error) {
			setImportExportFeedback("error", formatImportExportError(error, "Failed to export project."));
		} finally {
			importExportBusy = null;
		}
	}

	async function handleSvgExport() {
		if (importExportBusy) return;
		importExportBusy = "svg-export";
		importExportFeedback = null;

		try {
			const svg = await App.project.svg();
			downloadTextFile(sanitizeDownloadName($project.name, "svg"), svg, "image/svg+xml");
			setImportExportFeedback("success", "Standalone SVG exported with embedded assets and recovery metadata.");
		} catch (error) {
			setImportExportFeedback("error", formatImportExportError(error, "Failed to export SVG."));
		} finally {
			importExportBusy = null;
		}
	}

	function openProjectImportPicker() {
		projectImportInputRef?.click();
	}

	async function handleProjectImportFileChange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		if (importExportBusy) return;
		importExportBusy = "project-import";
		importExportFeedback = null;

		try {
			pendingImportedProject = App.codec.project.parse(await file.text());
			pendingImportedProjectName = file.name;
			importProjectDialogOpen = true;
		} catch (error) {
			pendingImportedProject = null;
			pendingImportedProjectName = "";
			setImportExportFeedback("error", formatImportExportError(error, "Failed to read project file."));
		} finally {
			importExportBusy = null;
		}

		input.value = "";
	}

	async function confirmProjectImport() {
		if (!pendingImportedProject) return;
		if (importExportBusy) return;
		importExportBusy = "project-import";

		try {
			await App.project.import(pendingImportedProject);
			setImportExportFeedback("success", `Imported ${pendingImportedProjectName || "project file"}.`);
			importProjectDialogOpen = false;
			pendingImportedProject = null;
			pendingImportedProjectName = "";
		} catch (error) {
			setImportExportFeedback("error", formatImportExportError(error, "Failed to import project file."));
		} finally {
			importExportBusy = null;
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

	function startEditingElement(element: Element) {
		editingElementId = element.id;
		editingElementName = element.name;
	}

	function saveElementEdit() {
		const trimmed = editingElementName.trim();
		if (editingElementId) {
			App.actions.project.renameElement(editingElementId, trimmed);
		}
		editingElementId = null;
	}

	function autofixElementName(elementId: string, suggestion: string) {
		App.actions.project.renameElement(elementId, suggestion);
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
		App.actions.project.selectElement(null);
	}

	function setElementContextMenuOpen(elementId: string, open: boolean) {
		openElementContextMenuId = open
			? elementId
			: openElementContextMenuId === elementId
				? null
				: openElementContextMenuId;
	}

	function closeElementContextMenu() {
		openElementContextMenuId = null;
	}

	function getInsertionIndex(clientY: number) {
		if (!elementListRef || !reorderState) return reorderState?.insertionIndex ?? 0;

		const rows = Array.from(elementListRef.querySelectorAll<HTMLElement>("[data-element-row]")).filter(
			(row) => row.dataset.elementId !== reorderState?.elementId
		);

		for (const [index, row] of rows.entries()) {
			const bounds = row.getBoundingClientRect();
			if (clientY < bounds.top + bounds.height / 2) return index;
		}

		return rows.length;
	}

	function updateAutoScroll(clientY: number) {
		if (!elementScrollViewport || !reorderState) return;

		const bounds = elementScrollViewport.getBoundingClientRect();
		const edgeSize = 36;
		const maxVelocity = 10;

		if (clientY < bounds.top + edgeSize) {
			autoScrollVelocity = -maxVelocity * (1 - (clientY - bounds.top) / edgeSize);
		} else if (clientY > bounds.bottom - edgeSize) {
			autoScrollVelocity = maxVelocity * (1 - (bounds.bottom - clientY) / edgeSize);
		} else {
			autoScrollVelocity = 0;
		}

		if (autoScrollVelocity !== 0 && autoScrollFrame === null) {
			autoScrollFrame = requestAnimationFrame(runAutoScroll);
		}
	}

	function runAutoScroll() {
		autoScrollFrame = null;
		if (!elementScrollViewport || !reorderState || autoScrollVelocity === 0) return;

		elementScrollViewport.scrollBy({ top: autoScrollVelocity });
		reorderState.insertionIndex = getInsertionIndex(reorderState.lastClientY);
		autoScrollFrame = requestAnimationFrame(runAutoScroll);
	}

	function stopAutoScroll() {
		autoScrollVelocity = 0;
		if (autoScrollFrame !== null && typeof cancelAnimationFrame !== "undefined") {
			cancelAnimationFrame(autoScrollFrame);
			autoScrollFrame = null;
		}
	}

	function clearPendingReorder() {
		if (!pendingReorderState) return;

		clearTimeout(pendingReorderState.timer);
		pendingReorderState = null;
		if (typeof window === "undefined") return;

		window.removeEventListener("pointermove", handlePendingReorderPointerMove);
		window.removeEventListener("pointerup", clearPendingReorder);
		window.removeEventListener("pointercancel", clearPendingReorder);
	}

	function startPendingReorder(event: PointerEvent, element: Element, sidebarIndex: number) {
		if (event.button !== 0 || isEditingElementTarget(event.target)) return;

		clearPendingReorder();
		pendingReorderState = {
			elementId: element.id,
			fromSidebarIndex: sidebarIndex,
			lastClientY: event.clientY,
			timer: setTimeout(startReorderingFromPending, REORDER_HOLD_DELAY_MS)
		};

		window.addEventListener("pointermove", handlePendingReorderPointerMove);
		window.addEventListener("pointerup", clearPendingReorder);
		window.addEventListener("pointercancel", clearPendingReorder);
	}

	function isEditingElementTarget(target: EventTarget | null) {
		return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
	}

	function handlePendingReorderPointerMove(event: PointerEvent) {
		if (!pendingReorderState) return;

		pendingReorderState.lastClientY = event.clientY;
	}

	function startReorderingFromPending() {
		if (!pendingReorderState) return;

		const pending = pendingReorderState;
		pendingReorderState = null;
		suppressNextElementClick = true;
		reorderState = {
			elementId: pending.elementId,
			fromSidebarIndex: pending.fromSidebarIndex,
			insertionIndex: pending.fromSidebarIndex,
			lastClientY: pending.lastClientY
		};

		window.removeEventListener("pointermove", handlePendingReorderPointerMove);
		window.removeEventListener("pointerup", clearPendingReorder);
		window.removeEventListener("pointercancel", clearPendingReorder);
		window.addEventListener("pointermove", handleReorderPointerMove);
		window.addEventListener("pointerup", stopReordering);
		window.addEventListener("pointercancel", cancelReordering);
	}

	function handleElementRowClick(event: MouseEvent, elementId: string) {
		if (suppressNextElementClick) {
			event.preventDefault();
			event.stopPropagation();
			suppressNextElementClick = false;
			return;
		}

		App.actions.project.selectElement(elementId);
	}

	function handleReorderPointerMove(event: PointerEvent) {
		if (!reorderState) return;

		reorderState.lastClientY = event.clientY;
		reorderState.insertionIndex = getInsertionIndex(event.clientY);
		updateAutoScroll(event.clientY);
	}

	function removeReorderListeners() {
		if (typeof window === "undefined") return;

		window.removeEventListener("pointermove", handleReorderPointerMove);
		window.removeEventListener("pointerup", stopReordering);
		window.removeEventListener("pointercancel", cancelReordering);
		stopAutoScroll();
	}

	function stopReordering() {
		if (!reorderState) return;

		const elementCount = $project.elements.length;
		const fromProjectIndex = elementCount - 1 - reorderState.fromSidebarIndex;
		const toProjectIndex = elementCount - 1 - reorderState.insertionIndex;

		if (fromProjectIndex !== toProjectIndex) {
			App.actions.project.reorderElements(fromProjectIndex, toProjectIndex);
		}

		reorderState = null;
		removeReorderListeners();
	}

	function cancelReordering() {
		clearPendingReorder();
		suppressNextElementClick = false;
		reorderState = null;
		removeReorderListeners();
	}

	$effect(() => {
		if (editingElementId && editingElementInputRef) {
			editingElementInputRef.focus();
			editingElementInputRef.select();
		}
	});

	$effect(() => {
		if (!$project.initialized) return;
		// Do not overwrite the local draft while the project name input is active.
		if (isEditing) return;
		editName = $project.name;
		importsOpen = $project.importExportState.importsOpen;
		elementsOpen = $project.importExportState.elementsOpen;
	});

	$effect(() => {
		if (!$project.initialized) return;
		// Collapsible state is part of the persisted project UI state.
		App.actions.project.setImportExportState({ importsOpen, elementsOpen });
	});

	onDestroy(() => {
		if (importExportFeedbackTimer) {
			clearTimeout(importExportFeedbackTimer);
		}

		cancelReordering();
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
				<input
					bind:this={projectImportInputRef}
					type="file"
					accept="application/json,.json"
					onchange={handleProjectImportFileChange}
					class="hidden"
				/>
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
						<DropdownMenu.Item class="justify-center text-center text-xs" onclick={openProjectImportPicker}
							>Project</DropdownMenu.Item
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
						<DropdownMenu.Item
							class="justify-center text-center text-xs"
							onclick={() => void handleSvgExport()}>SVG</DropdownMenu.Item
						>
						<DropdownMenu.Item class="justify-center text-center text-xs" onclick={handleProjectExport}
							>Project</DropdownMenu.Item
						>
					</DropdownMenu.Content>
				</DropdownMenu.Root>

				{#if importExportFeedback}
					<p
						class="px-1 text-center text-[11px] leading-4 {importExportFeedback.tone === 'error'
							? 'text-destructive'
							: 'text-muted-foreground'}"
					>
						{importExportFeedback.text}
					</p>
				{/if}
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
		<Collapsible.Content class="sidebar-collapsible-content flex min-h-0 flex-col">
			<div class="flex min-h-0 flex-1 flex-col">
				<ContextMenu.Root>
					<ContextMenu.Trigger class="flex min-h-0 flex-1 flex-col">
						<ScrollArea class="min-h-0 flex-1" bind:viewportRef={elementScrollViewport}>
							<div
								bind:this={elementListRef}
								class="flex min-h-full flex-col gap-0.5 p-2"
								onpointerdown={handleElementTreeBackgroundPointerDown}
								role="presentation"
							>
								{#each sidebarElements() as element, sidebarIndex (element.id)}
									{@const Icon = elementIcons[element.type]}
									{@const isSelected = $project.selectedElementId === element.id}
									{@const isEditingElement = editingElementId === element.id}
									{@const nameValidation = elementNameValidations.get(element.id)}
									{@const isInvalidName = !!nameValidation && !nameValidation.valid}
									{@const isReordering = reorderState?.elementId === element.id}
									{@const projectLayerIndex = $project.elements.findIndex((e) => e.id === element.id)}
									{@const isFrontmost = projectLayerIndex === $project.elements.length - 1}
									{@const isBackmost = projectLayerIndex === 0}
									<ContextMenu.Root
										open={openElementContextMenuId === element.id}
										onOpenChange={(open) => setElementContextMenuOpen(element.id, open)}
									>
										<ContextMenu.Trigger class="contents">
											<div
												data-element-row
												data-element-id={element.id}
												class="group flex w-full items-center rounded-lg {isInvalidName
													? 'bg-destructive/10 text-destructive hover:bg-destructive/15'
													: isReordering
														? 'ring-sidebar-ring/50 bg-sidebar-accent/80 text-sidebar-accent-foreground shadow-sm ring-1'
														: isSelected
															? 'bg-sidebar-accent text-sidebar-accent-foreground'
															: 'text-sidebar-foreground hover:bg-sidebar-accent/50'}"
											>
												<button
													type="button"
													class="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-xs outline-none select-none"
													onpointerdown={(event) =>
														startPendingReorder(event, element, sidebarIndex)}
													onclick={(event) => handleElementRowClick(event, element.id)}
													ondblclick={() => startEditingElement(element)}
												>
													<Icon
														class="size-3 shrink-0 {isInvalidName
															? 'text-destructive'
															: 'text-muted-foreground'}"
													/>
													{#if isEditingElement}
														<Input
															bind:ref={
																() => editingElementInputRef,
																(v) => (editingElementInputRef = v)
															}
															bind:value={editingElementName}
															onblur={saveElementEdit}
															onkeydown={handleElementEditKeydown}
															class="h-4 min-h-0 min-w-0 flex-1 border-0 bg-transparent p-0 text-xs leading-4 shadow-none transition-none focus-visible:ring-0 focus-visible:ring-offset-0"
															style="font: inherit;"
														/>
													{:else}
														<span class="truncate" title={element.name}>{element.name}</span
														>
													{/if}
												</button>
												{#if isInvalidName && nameValidation}
													<ElementNameValidation
														validation={nameValidation}
														onAutofix={(suggestion) =>
															autofixElementName(element.id, suggestion)}
														class={isEditingElement ? "mr-1" : ""}
													/>
												{/if}
												<button
													type="button"
													class="text-sidebar-foreground/60 hover:text-destructive px-2 py-1.5 opacity-0 transition-opacity duration-150 outline-none group-hover:opacity-100 focus-visible:opacity-100 {isEditingElement
														? 'hidden'
														: ''}"
													onclick={(event) => {
														event.stopPropagation();
														void App.element.delete(element.id);
													}}
													aria-label="Delete {element.name}"
												>
													<Trash2 class="size-3.5" />
												</button>
											</div>
										</ContextMenu.Trigger>
										<ContextMenu.Content>
											<ContextMenu.Item
												onclick={() => {
													App.actions.clipboard.copy(element);
													closeElementContextMenu();
												}}
											>
												Copy
											</ContextMenu.Item>
											<ContextMenu.Separator />
											<ContextMenu.Item
												disabled={isFrontmost}
												onclick={() => {
													App.actions.project.moveElementToFront(element.id);
													closeElementContextMenu();
												}}
											>
												Bring to front
											</ContextMenu.Item>
											<ContextMenu.Item
												disabled={isFrontmost}
												onclick={() => {
													App.actions.project.moveElementForward(element.id);
													closeElementContextMenu();
												}}
											>
												Bring forward
											</ContextMenu.Item>
											<ContextMenu.Item
												disabled={isBackmost}
												onclick={() => {
													App.actions.project.moveElementBackward(element.id);
													closeElementContextMenu();
												}}
											>
												Send backward
											</ContextMenu.Item>
											<ContextMenu.Item
												disabled={isBackmost}
												onclick={() => {
													App.actions.project.moveElementToBack(element.id);
													closeElementContextMenu();
												}}
											>
												Send to back
											</ContextMenu.Item>
											<ContextMenu.Separator />
											<ContextMenu.Item
												variant="destructive"
												onclick={() => {
													void App.element.delete(element.id);
													closeElementContextMenu();
												}}
											>
												Delete
											</ContextMenu.Item>
										</ContextMenu.Content>
									</ContextMenu.Root>
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
								const copied = App.actions.clipboard.get();
								if (!copied) return;
								void App.element.paste();
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

<aside class="border-border bg-sidebar flex shrink-0 flex-col border-r" style={`width: ${width}px;`}>
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
						<ChevronDown />
					</DropdownMenu.Trigger>
					<DropdownMenu.Content align="end">
						<DropdownMenu.Item onclick={() => handleCreateNewProject("blank")} class="text-xs">
							Blank canvas
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
			<AlertDialog.Cancel onclick={cancelProjectImport} disabled={importExportBusy === "project-import"}
				>Cancel</AlertDialog.Cancel
			>
			<AlertDialog.Action
				onclick={() => void confirmProjectImport()}
				disabled={importExportBusy === "project-import"}
				>{importExportBusy === "project-import" ? "Importing..." : "Replace project"}</AlertDialog.Action
			>
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
