<script lang="ts">
	import Logo from "$lib/assets/favicon.svg";
	import * as ToggleGroup from "$lib/components/ui/toggle-group";
	import { useTheme } from "$lib/state/theme.svelte";
	import Monitor from "phosphor-svelte/lib/Monitor";
	import Moon from "phosphor-svelte/lib/Moon";
	import Sun from "phosphor-svelte/lib/Sun";

	const theme = useTheme();
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
	<div class="flex flex-row items-center gap-2">
		<img src={Logo} class="size-4" alt="Maply Logo" />
		<h1 class="text-foreground/50 font-extrabold uppercase select-none">Maply</h1>
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
