<script lang="ts">
	import * as ToggleGroup from "$lib/components/ui/toggle-group";
	import { App } from "@app";
	import Monitor from "phosphor-svelte/lib/Monitor";
	import Moon from "phosphor-svelte/lib/Moon";
	import Sun from "phosphor-svelte/lib/Sun";

	const theme = App.theme.use();
	function handleChange(value: string | undefined) {
		if (value === "light" || value === "dark" || value === "system") {
			App.theme.set(value);
		}
	}
</script>

<header class="flex h-6 shrink-0 items-center justify-between px-3">
	<h1 class="text-sm font-semibold">Maply</h1>

	<ToggleGroup.Root
		type="single"
		value={theme.theme}
		onValueChange={handleChange}
		variant="default"
		size="sm"
		class="gap-0.5"
	>
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
