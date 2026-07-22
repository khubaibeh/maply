<script lang="ts">
	import type { Grid } from "./use-grid.svelte";

	interface Props {
		colIndex: number;
		value: string;
		selected: boolean;
		grid: Grid;
	}

	let { colIndex, value, selected, grid }: Props = $props();
	let editing = $state(false);
	let input: HTMLInputElement | null = $state(null);
	let localValue = $derived(value);

	$effect(() => {
		if (editing && input) {
			input.focus();
			input.select();
		}
	});

	function handlePointerDown(event: PointerEvent) {
		if (event.button !== 0 || event.target instanceof HTMLInputElement) return;
		event.preventDefault();
		event.stopPropagation();
		grid.startColumnSelection(colIndex, event.shiftKey, event.ctrlKey || event.metaKey);
	}

	function handlePointerEnter(event: PointerEvent) {
		if ((event.buttons & 1) !== 0) grid.extendColumnSelection(colIndex);
	}

	function handleDoubleClick(event: MouseEvent) {
		event.stopPropagation();
		editing = true;
	}

	function handleInputKeydown(event: KeyboardEvent) {
		if (event.key === "Enter") {
			event.preventDefault();
			grid.setHeader(colIndex, localValue);
			editing = false;
		} else if (event.key === "Escape") {
			event.preventDefault();
			localValue = value;
			editing = false;
		}
	}

	function handleBlur() {
		if (editing) {
			grid.setHeader(colIndex, localValue);
			editing = false;
		}
	}
</script>

<div
	class="border-border text-foreground relative flex h-8 cursor-pointer items-center overflow-hidden border-r border-b-2 px-2 py-1 text-xs font-semibold transition-colors select-none {selected
		? 'bg-primary/20 text-foreground ring-primary z-10 ring-1 ring-inset'
		: 'bg-sidebar/50 hover:bg-sidebar/70'}"
	role="columnheader"
	aria-selected={selected}
	tabindex="0"
	onpointerdown={handlePointerDown}
	onpointerenter={handlePointerEnter}
	ondblclick={handleDoubleClick}
	onkeydown={(e) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			grid.selectColumn(colIndex, e.shiftKey, e.ctrlKey || e.metaKey);
		}
	}}
>
	{#if editing}
		<input
			bind:this={input}
			bind:value={localValue}
			type="text"
			class="text-foreground m-0 min-w-0 flex-1 border-0 bg-transparent p-0 text-xs leading-none font-semibold outline-none"
			style="font: inherit;"
			onkeydown={handleInputKeydown}
			onblur={handleBlur}
			onclick={(e) => e.stopPropagation()}
		/>
	{:else}
		<span class="truncate">{value || "Column"}</span>
	{/if}
</div>
