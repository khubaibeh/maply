<script lang="ts">
	import ElementsSection from "@components/left-sidebar/ElementsSection.svelte";

	let { width = 240 }: { width?: number } = $props();
</script>

<aside class="flex min-h-0 shrink-0 flex-col" style={`width: ${width}px;`}>
	<div class="border-border bg-sidebar flex min-h-0 flex-1 overflow-hidden rounded-2xl border">
		<ElementsSection />
	</div>
</aside>
