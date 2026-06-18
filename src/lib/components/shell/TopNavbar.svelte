<script lang="ts">
	import * as ToggleGroup from "$lib/components/ui/toggle-group";
	import { getTheme } from "$lib/theme.svelte";
	import Monitor from "@lucide/svelte/icons/monitor";
	import Moon from "@lucide/svelte/icons/moon";
	import Sun from "@lucide/svelte/icons/sun";

	const theme = getTheme();

	function handleChange(value: string | undefined) {
		if (value === "light" || value === "dark" || value === "system") {
			theme.theme = value;
		}
	}
</script>

<header class="border-border bg-sidebar flex h-10 shrink-0 items-center justify-between border-b px-3">
	<div class="flex items-center gap-2">
		<span class="text-sm font-semibold">Maply</span>
	</div>

	<ToggleGroup.Root
		type="single"
		value={theme.theme}
		onValueChange={handleChange}
		variant="default"
		size="sm"
		class="bg-muted rounded-lg p-0.5"
	>
		<ToggleGroup.Item
			value="light"
			aria-label="Light"
			class="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground size-7 rounded-md"
		>
			<Sun />
		</ToggleGroup.Item>
		<ToggleGroup.Item
			value="system"
			aria-label="System"
			class="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground size-7 rounded-md"
		>
			<Monitor />
		</ToggleGroup.Item>
		<ToggleGroup.Item
			value="dark"
			aria-label="Dark"
			class="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground size-7 rounded-md"
		>
			<Moon />
		</ToggleGroup.Item>
	</ToggleGroup.Root>
</header>
