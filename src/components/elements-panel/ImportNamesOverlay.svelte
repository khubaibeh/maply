<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import GridNineIcon from "phosphor-svelte/lib/GridNineIcon";
	import XIcon from "phosphor-svelte/lib/XIcon";

	let { onClose }: { onClose: () => void } = $props();
</script>

<div
	class="bg-background/20 fixed inset-0 z-50 flex items-center justify-center p-10 backdrop-blur-[2px]"
	role="dialog"
	aria-modal="true"
	aria-labelledby="import-names-title"
>
	<section
		class="border-border bg-background text-foreground h-full max-h-[800px] min-h-[600px] w-full max-w-[1000px] min-w-[400px] rounded-2xl border shadow-2xl"
	>
		<div class="flex items-center justify-between px-6 py-5">
			<h2 id="import-names-title" class="flex items-center gap-2 text-base font-semibold">
				<GridNineIcon class="size-5" />
				Element Names
			</h2>
			<Button variant="ghost" size="icon-xs" class="rounded-md" onclick={onClose} aria-label="Close import names">
				<XIcon />
			</Button>
		</div>
	</section>
</div>
