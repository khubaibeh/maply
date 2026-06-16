<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import MousePointer2 from '@lucide/svelte/icons/mouse-pointer-2';
	import Hand from '@lucide/svelte/icons/hand';
	import Square from '@lucide/svelte/icons/square';
	import Circle from '@lucide/svelte/icons/circle';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Type from '@lucide/svelte/icons/type';
	import Image from '@lucide/svelte/icons/image';
</script>

<div class="flex h-12 shrink-0 items-center gap-1 border-t border-border bg-background px-3">
	<Button variant="secondary" size="sm" class="h-8 gap-1.5 rounded-lg px-2 text-xs">
		<MousePointer2 data-icon="inline-start" />
		Select
	</Button>
	<Button variant="ghost" size="sm" class="h-8 gap-1.5 rounded-lg px-2 text-xs">
		<Hand data-icon="inline-start" />
		Hand
	</Button>
	<Separator orientation="vertical" class="mx-1 h-5" />
	<Button variant="ghost" size="sm" class="h-8 gap-1.5 rounded-lg px-2 text-xs">
		<Square data-icon="inline-start" />
		Rect
	</Button>
	<Button variant="ghost" size="sm" class="h-8 gap-1.5 rounded-lg px-2 text-xs">
		<Circle data-icon="inline-start" />
		Circle
	</Button>
	<Button variant="ghost" size="sm" class="h-8 gap-1.5 rounded-lg px-2 text-xs">
		<Pencil data-icon="inline-start" />
		Path
	</Button>
	<Button variant="ghost" size="sm" class="h-8 gap-1.5 rounded-lg px-2 text-xs">
		<Type data-icon="inline-start" />
		Text
	</Button>
	<Button variant="ghost" size="sm" class="h-8 gap-1.5 rounded-lg px-2 text-xs">
		<Image data-icon="inline-start" />
		Image
	</Button>
</div>
