<script lang="ts">
	import type { CellAddr } from "./grid-model";
	import type { Grid } from "./use-grid.svelte";

	interface Props {
		addr: CellAddr;
		value: string;
		status: "normal" | "selected" | "active" | "editing";
		grid: Grid;
		onFocus?: () => void;
	}

	let { addr, value, status, grid, onFocus }: Props = $props();
	let cell: HTMLDivElement | null = $state(null);
	let input: HTMLInputElement | null = $state(null);
	let localValue = $derived(value);

	$effect(() => {
		if (status === "editing" && input) {
			input.focus();
			input.select();
		}
	});

	function handlePointerDown(event: PointerEvent) {
		if (event.button !== 0 || event.target instanceof HTMLInputElement) return;
		event.preventDefault();
		grid.startCellSelection(addr, event.shiftKey);
		onFocus?.();
		if (event.currentTarget instanceof HTMLElement) event.currentTarget.focus();
	}

	function handlePointerEnter(event: PointerEvent) {
		if ((event.buttons & 1) === 0) return;
		grid.extendCellSelection(addr);
	}

	function handleDoubleClick() {
		grid.setEditing(addr);
	}

	function handleInputKeydown(event: KeyboardEvent) {
		if (event.key === "Enter") {
			event.preventDefault();
			event.stopPropagation();
			grid.commitEdit(localValue);
			cell?.focus();
		} else if (event.key === "Tab") {
			event.preventDefault();
			event.stopPropagation();
			grid.commitEdit(localValue);
			grid.handleKeydown(event);
		} else if (event.key === "Escape") {
			event.preventDefault();
			event.stopPropagation();
			grid.cancelEdit();
		}
	}

	function handleBlur() {
		if (status === "editing") {
			grid.commitEdit(localValue);
		}
	}
</script>

<div
	bind:this={cell}
	class="border-border text-foreground relative flex min-h-8 cursor-cell items-center border-r border-b px-2 py-1 text-xs transition-colors outline-none select-none {status ===
	'editing'
		? 'bg-background ring-primary z-20 ring-1 ring-inset'
		: status === 'active'
			? 'bg-primary/10 ring-primary z-10 ring-1 ring-inset'
			: status === 'selected'
				? 'bg-primary/10'
				: 'bg-background'}"
	role="gridcell"
	aria-selected={status === "selected" || status === "active"}
	onpointerdown={handlePointerDown}
	onpointerenter={handlePointerEnter}
	ondblclick={handleDoubleClick}
	tabindex={status === "active" || status === "editing" ? 0 : -1}
>
	{#if status === "editing"}
		<input
			bind:this={input}
			bind:value={localValue}
			type="text"
			class="text-foreground m-0 min-w-0 flex-1 border-0 bg-transparent p-0 text-xs leading-none outline-none"
			style="font: inherit;"
			onkeydown={handleInputKeydown}
			onblur={handleBlur}
		/>
	{:else}
		<span class="min-w-0 [overflow-wrap:anywhere] whitespace-normal">{value}</span>
	{/if}
</div>
