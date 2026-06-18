<script lang="ts">
	import { cn, type WithoutChild } from "$lib/utils.js";
	import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
	import { ContextMenu as ContextMenuPrimitive } from "bits-ui";

	let {
		ref = $bindable(null),
		class: className,
		inset,
		children,
		...restProps
	}: WithoutChild<ContextMenuPrimitive.SubTriggerProps> & {
		inset?: boolean;
	} = $props();
</script>

<ContextMenuPrimitive.SubTrigger
	bind:ref
	data-slot="context-menu-sub-trigger"
	data-inset={inset}
	class={cn(
		"focus:bg-accent focus:text-accent-foreground data-open:bg-accent data-open:text-accent-foreground flex min-h-7 cursor-default items-center rounded-xl px-2 py-1.5 text-sm outline-hidden select-none data-inset:ps-8 data-inset:pl-7 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
		className
	)}
	{...restProps}
>
	{@render children?.()}
	<ChevronRightIcon class="ml-auto" />
</ContextMenuPrimitive.SubTrigger>
