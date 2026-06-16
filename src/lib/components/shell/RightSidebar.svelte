<script lang="ts">
	import * as Tabs from '$lib/components/ui/tabs';
	import { Separator } from '$lib/components/ui/separator';
	import { ScrollArea } from '$lib/components/ui/scroll-area';
</script>

<aside class="flex w-72 shrink-0 flex-col border-l border-border bg-sidebar">
	<div class="border-b border-border px-3 py-2">
		<span class="text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/80"
			>Properties</span
		>
	</div>

	<Tabs.Root value="layout" class="flex min-h-0 flex-1 flex-col">
		<Tabs.List class="h-8 w-full rounded-none bg-transparent p-0">
			<Tabs.Trigger
				value="layout"
				class="flex-1 rounded-none text-xs data-[state=active]:bg-background">Layout</Tabs.Trigger
			>
			<Tabs.Trigger
				value="style"
				class="flex-1 rounded-none text-xs data-[state=active]:bg-background">Style</Tabs.Trigger
			>
			<Tabs.Trigger
				value="data"
				class="flex-1 rounded-none text-xs data-[state=active]:bg-background">Data</Tabs.Trigger
			>
		</Tabs.List>
		<Separator />

		<Tabs.Content value="layout" class="mt-0 min-h-0 flex-1 p-0">
			<ScrollArea class="h-full">
				<div class="p-3">
					<p class="text-xs text-muted-foreground">Select an element to edit layout</p>
				</div>
			</ScrollArea>
		</Tabs.Content>

		<Tabs.Content value="style" class="mt-0 min-h-0 flex-1 p-0">
			<ScrollArea class="h-full">
				<div class="p-3">
					<p class="text-xs text-muted-foreground">Select an element to edit style</p>
				</div>
			</ScrollArea>
		</Tabs.Content>

		<Tabs.Content value="data" class="mt-0 min-h-0 flex-1 p-0">
			<ScrollArea class="h-full">
				<div class="p-3">
					<p class="text-xs text-muted-foreground">Select an element to bind data</p>
				</div>
			</ScrollArea>
		</Tabs.Content>
	</Tabs.Root>
</aside>
