<script lang="ts">
	import ElementsSection from "@components/left-sidebar/ElementsSection.svelte";
	import ImportExportSection from "@components/left-sidebar/ImportExportSection.svelte";
	import ProjectSection from "@components/left-sidebar/ProjectSection.svelte";

	let { width = 240 }: { width?: number } = $props();
</script>

<aside class="border-border bg-sidebar flex shrink-0 flex-col border-r" style={`width: ${width}px;`}>
	<ProjectSection />
	<ImportExportSection />
	<ElementsSection />
</aside>
