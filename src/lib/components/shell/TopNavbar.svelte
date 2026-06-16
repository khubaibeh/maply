<script lang="ts">
	import * as ToggleGroup from '$lib/components/ui/toggle-group';
	import { getTheme } from '$lib/theme.svelte';
	import Sun from '@lucide/svelte/icons/sun';
	import Monitor from '@lucide/svelte/icons/monitor';
	import Moon from '@lucide/svelte/icons/moon';

	const theme = getTheme();

	function handleChange(value: string | undefined) {
		if (value === 'light' || value === 'dark' || value === 'system') {
			theme.theme = value;
		}
	}
</script>

<header
	class="flex h-10 shrink-0 items-center justify-between border-b border-border bg-sidebar px-3"
>
	<div class="flex items-center gap-2">
		<span class="text-sm font-semibold">Maply</span>
	</div>

	<ToggleGroup.Root
		type="single"
		value={theme.theme}
		onValueChange={handleChange}
		variant="default"
		size="sm"
		class="rounded-lg bg-muted p-0.5"
	>
		<ToggleGroup.Item
			value="light"
			aria-label="Light"
			class="size-7 rounded-md data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
		>
			<Sun />
		</ToggleGroup.Item>
		<ToggleGroup.Item
			value="system"
			aria-label="System"
			class="size-7 rounded-md data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
		>
			<Monitor />
		</ToggleGroup.Item>
		<ToggleGroup.Item
			value="dark"
			aria-label="Dark"
			class="size-7 rounded-md data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
		>
			<Moon />
		</ToggleGroup.Item>
	</ToggleGroup.Root>
</header>
