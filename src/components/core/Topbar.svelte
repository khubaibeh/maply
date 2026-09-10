<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import * as ToggleGroup from "$lib/components/ui/toggle-group";
	import { useTheme } from "$lib/state.svelte";
	import { Editor } from "editor";
	import ArrowClockwise from "phosphor-svelte/lib/ArrowClockwise";
	import ArrowCounterClockwise from "phosphor-svelte/lib/ArrowCounterClockwise";
	import Monitor from "phosphor-svelte/lib/Monitor";
	import Moon from "phosphor-svelte/lib/Moon";
	import Sun from "phosphor-svelte/lib/Sun";

	const theme = useTheme();
	const canUndo = Editor.history.canUndo;
	const canRedo = Editor.history.canRedo;
	let value = $derived(theme.theme);

	function handleChange(next: string | undefined) {
		if (next === "light" || next === "dark" || next === "system") {
			theme.theme = next;
			return;
		}

		value = theme.theme;
	}
</script>

<header class="flex h-6 shrink-0 items-center justify-between px-3">
	<div class="flex items-center gap-1" role="toolbar" aria-label="Edit history">
		<Button
			variant="ghost"
			size="icon-xs"
			disabled={!$canUndo}
			onclick={() => void Editor.history.undo()}
			aria-label="Undo"
			title="Undo (Ctrl+Z)"
		>
			<ArrowCounterClockwise />
		</Button>
		<Button
			variant="ghost"
			size="icon-xs"
			disabled={!$canRedo}
			onclick={() => void Editor.history.redo()}
			aria-label="Redo"
			title="Redo (Ctrl+Shift+Z)"
		>
			<ArrowClockwise />
		</Button>
	</div>
	<ToggleGroup.Root type="single" bind:value onValueChange={handleChange} variant="default" size="sm" class="gap-0.5">
		<ToggleGroup.Item
			value="light"
			aria-label="Light"
			class="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground size-6 rounded-full!"
		>
			<Sun />
		</ToggleGroup.Item>
		<ToggleGroup.Item
			value="system"
			aria-label="System"
			class="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground size-6 rounded-full!"
		>
			<Monitor />
		</ToggleGroup.Item>
		<ToggleGroup.Item
			value="dark"
			aria-label="Dark"
			class="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground size-6 rounded-full!"
		>
			<Moon />
		</ToggleGroup.Item>
	</ToggleGroup.Root>
</header>
