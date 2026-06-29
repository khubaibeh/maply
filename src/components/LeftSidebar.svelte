<script lang="ts">
	import Sidebar from "$lib/components/app/panels/LeftSidebar.svelte";

	let { width }: { width: number } = $props();
</script>

<Sidebar {width} />
