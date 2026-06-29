<script lang="ts">
	import * as Collapsible from "$lib/components/ui/collapsible";
	import * as ContextMenu from "$lib/components/ui/context-menu";
	import { Input } from "$lib/components/ui/input";
	import { ScrollArea } from "$lib/components/ui/scroll-area";
	import { App } from "@app";
	import type { Element } from "@app/types";
	import ElementNameValidation from "@components/core/ElementNameValidation.svelte";
	import ChevronDown from "@lucide/svelte/icons/chevron-down";
	import Circle from "@lucide/svelte/icons/circle";
	import Image from "@lucide/svelte/icons/image";
	import Pencil from "@lucide/svelte/icons/pencil";
	import Square from "@lucide/svelte/icons/square";
	import Trash2 from "@lucide/svelte/icons/trash-2";
	import Type from "@lucide/svelte/icons/type";
	import { onDestroy } from "svelte";
	import type { Component } from "svelte";

	const project = App.state.project;

	let elementsOpen = $state(true);
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

	$effect(() => {
		if (editingElementId && editingElementInputRef) {
			editingElementInputRef.focus();
			editingElementInputRef.select();
		}
	});

	$effect(() => {
		if (!$project.initialized) return;
		elementsOpen = $project.importExportState.elementsOpen;
	});

	$effect(() => {
		if (!$project.initialized) return;
		App.actions.project.setImportExportState({ elementsOpen });
	});

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

	onDestroy(() => {
		cancelReordering();
	});
</script>

{#snippet elementRow(element: Element, sidebarIndex: number)}
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
					onpointerdown={(event) => startPendingReorder(event, element, sidebarIndex)}
					onclick={(event) => handleElementRowClick(event, element.id)}
					ondblclick={() => startEditingElement(element)}
				>
					<Icon class="size-3 shrink-0 {isInvalidName ? 'text-destructive' : 'text-muted-foreground'}" />
					{@render elementLabel(element, isEditingElement)}
				</button>
				{@render elementValidation(element, nameValidation, isEditingElement, isInvalidName)}
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
		{@render elementMenu(element, isFrontmost, isBackmost)}
	</ContextMenu.Root>
{/snippet}

{#snippet elementLabel(element: Element, isEditingElement: boolean)}
	{#if isEditingElement}
		<Input
			bind:ref={() => editingElementInputRef, (v) => (editingElementInputRef = v)}
			bind:value={editingElementName}
			onblur={saveElementEdit}
			onkeydown={handleElementEditKeydown}
			class="h-4 min-h-0 min-w-0 flex-1 border-0 bg-transparent p-0 text-xs leading-4 shadow-none transition-none focus-visible:ring-0 focus-visible:ring-offset-0"
			style="font: inherit;"
		/>
	{:else}
		<span class="truncate" title={element.name}>{element.name}</span>
	{/if}
{/snippet}

{#snippet elementValidation(
	element: Element,
	nameValidation: ReturnType<typeof elementNameValidations.get>,
	isEditingElement: boolean,
	isInvalidName: boolean
)}
	{#if isInvalidName && nameValidation}
		<ElementNameValidation
			validation={nameValidation}
			onAutofix={(suggestion) => autofixElementName(element.id, suggestion)}
			class={isEditingElement ? "mr-1" : ""}
		/>
	{/if}
{/snippet}

{#snippet elementMenu(element: Element, isFrontmost: boolean, isBackmost: boolean)}
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
{/snippet}

<div class="flex min-h-0 flex-1 flex-col">
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
									{@render elementRow(element, sidebarIndex)}
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
</div>

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
