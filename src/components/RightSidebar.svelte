<script lang="ts">
	import Sidebar from "$lib/components/app/panels/RightSidebar.svelte";

	let { width }: { width: number } = $props();
</script>

<Sidebar {width} />
