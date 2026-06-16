<script lang="ts">
	import { ScrollArea } from '$lib/components/ui/scroll-area';
	import { Separator } from '$lib/components/ui/separator';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
</script>

<aside class="flex w-60 shrink-0 flex-col border-r border-border bg-sidebar">
	<div class="border-b border-border p-3">
		<span class="text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/80"
			>Project</span
		>
		<div class="mt-2">
			<Input class="h-7 text-xs" placeholder="Project name" />
		</div>
	</div>

	<div class="border-b border-border p-3">
		<span class="text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/80"
			>Imports</span
		>
		<div class="mt-2 flex flex-col gap-1.5">
			<Button variant="outline" size="sm" class="h-7 w-full justify-start text-xs"
				>Import SVG</Button
			>
			<Button variant="outline" size="sm" class="h-7 w-full justify-start text-xs"
				>Browse assets</Button
			>
		</div>
	</div>

	<div class="flex min-h-0 flex-1 flex-col border-b border-border">
		<div class="flex h-8 shrink-0 items-center px-3">
			<span class="text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/80"
				>Layers</span
			>
		</div>
		<Separator />
		<ScrollArea class="min-h-0 flex-1">
			<div class="p-2">
				<p class="text-xs text-muted-foreground">No layers</p>
			</div>
		</ScrollArea>
	</div>

	<div class="flex min-h-0 flex-1 flex-col">
		<div class="flex h-8 shrink-0 items-center px-3">
			<span class="text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/80"
				>Elements</span
			>
		</div>
		<Separator />
		<ScrollArea class="min-h-0 flex-1">
			<div class="p-2">
				<p class="text-xs text-muted-foreground">No elements</p>
			</div>
		</ScrollArea>
	</div>
</aside>
