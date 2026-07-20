<script lang="ts">
	import ElementsPanel from "@components/elements-panel/ElementsPanel.svelte";

	let { width = 240 }: { width?: number } = $props();
</script>

<aside class="flex min-h-0 shrink-0 flex-col" style={`width: ${width}px;`}>
	<div class="border-border/50 bg-sidebar/5 flex min-h-0 flex-1 overflow-hidden rounded-2xl border">
		<ElementsPanel />
	</div>
</aside>
