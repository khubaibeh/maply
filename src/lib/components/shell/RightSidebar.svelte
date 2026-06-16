<script lang="ts">
	import { ScrollArea } from '$lib/components/ui/scroll-area';
</script>

<aside class="flex w-72 shrink-0 flex-col border-l border-border bg-sidebar">
	<div class="border-b border-border px-3 py-2">
		<span class="text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/80">
			Properties
		</span>
	</div>
	<ScrollArea class="h-full">
		<div class="p-3">
			<p class="text-xs text-muted-foreground">Select an element to edit</p>
		</div>
	</ScrollArea>
</aside>
