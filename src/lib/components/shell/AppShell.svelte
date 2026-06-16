<script lang="ts">
	import LeftSidebar from './LeftSidebar.svelte';
	import RightSidebar from './RightSidebar.svelte';
	import CanvasArea from './CanvasArea.svelte';
	import BottomToolbar from './BottomToolbar.svelte';
</script>

<div class="flex h-screen w-screen overflow-hidden bg-background text-foreground">
	<LeftSidebar />

	<main class="flex min-w-0 flex-1 flex-col">
		<CanvasArea />
		<BottomToolbar />
	</main>

	<RightSidebar />
</div>
