<script lang="ts">
	import { Input } from "$lib/components/ui/input";

	type Props = {
		id: string;
		label: string;
		value: string | number;
		type?: "text" | "number";
		min?: number;
		step?: number;
		onChange: (value: string) => boolean | void;
	};

	let { id, label, value, type = "number", min, step, onChange }: Props = $props();
</script>

<div class="flex flex-col gap-1">
	<label for={id} class="text-sidebar-foreground/70 text-xs">{label}</label>
	<Input
		{id}
		{type}
		{min}
		{step}
		{value}
		onchange={(event) => {
			const input = event.currentTarget as HTMLInputElement;
			if (onChange(input.value) === false) input.value = String(value);
		}}
		class="no-spinner h-7 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
	/>
</div>
