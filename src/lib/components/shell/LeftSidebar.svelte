<script lang="ts">
	import * as Collapsible from '$lib/components/ui/collapsible';
	import { ScrollArea } from '$lib/components/ui/scroll-area';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import Pencil from '@lucide/svelte/icons/pencil';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';

	let projectName = $state('Untitled');
	let isEditing = $state(false);
	let inputRef: HTMLInputElement | null = $state(null);
	let importsOpen = $state(true);
	let elementsOpen = $state(true);

	$effect(() => {
		if (isEditing && inputRef) {
			inputRef.focus();
			inputRef.select();
		}
	});

	function startEditing() {
		isEditing = true;
	}

	function save() {
		isEditing = false;
	}

	function cancel() {
		isEditing = false;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			save();
		} else if (event.key === 'Escape') {
			cancel();
		}
	}
</script>

{#snippet sectionProject()}
	<div class="flex h-7 items-center justify-between gap-2">
		{#if isEditing}
			<Input
				bind:ref={() => inputRef, (v) => (inputRef = v)}
				bind:value={projectName}
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
				{projectName}
			</span>
		{/if}
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
	</div>
{/snippet}

{#snippet sectionImports()}
	<Collapsible.Root bind:open={importsOpen}>
		<Collapsible.Trigger
			class="flex h-8 w-full shrink-0 items-center justify-between border-b border-border px-3 text-left outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
		>
			<span class="text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/80">
				Imports
			</span>
			<ChevronDown
				class="size-4 text-sidebar-foreground/70 transition-transform duration-200 {importsOpen
					? 'rotate-180'
					: ''}"
			/>
		</Collapsible.Trigger>
		<Collapsible.Content class="sidebar-collapsible-content">
			<div class="p-3">
				<div class="flex flex-col gap-1.5">
					<Button variant="outline" size="sm" class="h-7 w-full justify-start text-xs"
						>Import SVG</Button
					>
					<Button variant="outline" size="sm" class="h-7 w-full justify-start text-xs"
						>Browse assets</Button
					>
				</div>
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
