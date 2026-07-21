<script lang="ts">
	import * as ContextMenu from "$lib/components/ui/context-menu";
	import { Input } from "$lib/components/ui/input";
	import ElementNameValidation from "@components/core/ElementNameValidation.svelte";
	import type { Element } from "@maply/model/types";
	import { Editor } from "editor";
	import type { ElementNameValidation as NameValidation } from "editor/types";
	import Circle from "phosphor-svelte/lib/Circle";
	import Image from "phosphor-svelte/lib/Image";
	import Pencil from "phosphor-svelte/lib/Pencil";
	import Rectangle from "phosphor-svelte/lib/Rectangle";
	import TextT from "phosphor-svelte/lib/TextT";
	import Trash from "phosphor-svelte/lib/Trash";
	import type { Component } from "svelte";

	import ElementRowContextMenu from "./ElementRowContextMenu.svelte";

	type Props = {
		element: Element;
		index: number;
		validation?: NameValidation;
		selected: boolean;
		active: boolean;
		onReorderStart: (event: PointerEvent, id: string, index: number) => void;
		onSelect: (event: PointerEvent, id: string) => void;
	};

	let { element, index, validation, selected, active, onReorderStart, onSelect }: Props = $props();
	let editing = $state(false);
	let name = $state("");
	let input: HTMLInputElement | null = $state(null);
	let menuOpen = $state(false);
	const invalid = $derived(!!validation && !validation.valid);
	const icons: Record<Element["type"], Component> = {
		rect: Rectangle,
		circle: Circle,
		path: Pencil,
		text: TextT,
		image: Image
	};
	const Icon = $derived(icons[element.type]);

	$effect(() => {
		if (!editing || !input) return;
		input.focus();
		input.select();
	});

	function edit() {
		name = element.name;
		editing = true;
	}

	function save() {
		const nextName = name.trim();
		if (nextName) Editor.element.rename(element.id, nextName);
		else name = element.name;
		editing = false;
	}
</script>

<ContextMenu.Root
	bind:open={menuOpen}
	onOpenChange={(open) => {
		if (open && !selected) Editor.selection.select(element.id);
	}}
>
	<ContextMenu.Trigger class="block w-full">
		<div
			data-element-row
			data-element-id={element.id}
			class="group grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center rounded-lg {invalid
				? 'bg-destructive/10 text-destructive hover:bg-destructive/15'
				: active
					? 'ring-sidebar-ring/50 bg-sidebar-accent/80 text-sidebar-accent-foreground shadow-sm ring-1'
					: selected
						? 'bg-sidebar-accent text-sidebar-accent-foreground'
						: 'text-sidebar-foreground hover:bg-sidebar-accent/50'}"
		>
			<button
				type="button"
				class="flex min-w-0 items-center gap-2 px-2 py-1.5 text-left text-xs outline-none select-none"
				onpointerdown={(event) => {
					onSelect(event, element.id);
					onReorderStart(event, element.id, index);
				}}
				ondblclick={edit}
			>
				<Icon class="size-3 shrink-0 {invalid ? 'text-destructive' : 'text-muted-foreground'}" />
				{#if editing}
					<Input
						bind:ref={() => input, (value) => (input = value)}
						bind:value={name}
						onblur={save}
						onkeydown={(event) => {
							if (event.key === "Enter") save();
							if (event.key === "Escape") editing = false;
						}}
						class="h-4 min-h-0 min-w-0 flex-1 rounded-none! border-0 bg-transparent p-0 text-xs leading-4 shadow-none transition-none focus-visible:ring-0 focus-visible:ring-offset-0"
						style="font: inherit;"
					/>
				{:else}
					<span class="block truncate rounded-none! px-0.5" title={element.name}>{element.name}</span>
				{/if}
			</button>
			{#if invalid && validation}
				<ElementNameValidation
					{validation}
					onAutofix={(suggestion) => Editor.element.rename(element.id, suggestion)}
					class={editing ? "mr-1" : ""}
				/>
			{/if}
			<button
				type="button"
				class="text-sidebar-foreground/60 hover:text-destructive mr-1 flex size-6 items-center justify-center rounded-md opacity-0 transition-[color,opacity] outline-none group-hover:opacity-100 focus-visible:opacity-100 {editing
					? 'hidden'
					: ''}"
				onclick={(event) => {
					event.stopPropagation();
					void Editor.element.delete(element.id);
				}}
				aria-label="Delete {element.name}"><Trash class="size-3.5" /></button
			>
		</div>
	</ContextMenu.Trigger>
	<ElementRowContextMenu {element} close={() => (menuOpen = false)} />
</ContextMenu.Root>
