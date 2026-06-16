<script lang="ts">
	import { ScrollArea } from '$lib/components/ui/scroll-area';
	import { Separator } from '$lib/components/ui/separator';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import Pencil from '@lucide/svelte/icons/pencil';

	let projectName = $state('Untitled');
	let isEditing = $state(false);
	let inputRef: HTMLInputElement | null = $state(null);

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

<aside class="flex w-60 shrink-0 flex-col border-r border-border bg-sidebar">
	<div class="border-b border-border p-3">
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
	</div>

	<div class="flex flex-col border-b border-border">
		<div class="flex h-8 shrink-0 items-center px-3">
			<span class="text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/80">
				Imports
			</span>
		</div>
		<Separator />
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
	</div>

	<div class="flex min-h-0 flex-1 flex-col">
		<div class="flex h-8 shrink-0 items-center px-3">
			<span class="text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/80">
				Elements
			</span>
		</div>
		<Separator />
		<ScrollArea class="min-h-0 flex-1">
			<div class="p-2">
				<p class="text-xs text-muted-foreground">No elements</p>
			</div>
		</ScrollArea>
	</div>
</aside>
