<script lang="ts">
	import { Badge } from "$lib/components/ui/badge";
	import type { Element } from "@maply/model/types";

	interface Props {
		elements: readonly Element[];
	}

	let { elements }: Props = $props();
</script>

<div
	class="border-border bg-muted/20 flex min-h-8 flex-wrap items-center gap-1 border-r border-b px-2 py-1"
	role="gridcell"
	aria-readonly="true"
>
	{#each elements as element (element.id)}
		<Badge variant="secondary" title={`${element.type}: ${element.name}`}>{element.name}</Badge>
	{:else}
		<span class="text-muted-foreground text-xs">None</span>
	{/each}
</div>
