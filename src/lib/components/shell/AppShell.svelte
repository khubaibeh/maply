<script lang="ts">
	import TopNavbar from './TopNavbar.svelte';
	import LeftSidebar from './LeftSidebar.svelte';
	import RightSidebar from './RightSidebar.svelte';
	import CanvasArea from '$lib/components/canvas/CanvasArea.svelte';
	import BottomToolbar from './BottomToolbar.svelte';
</script>

<div class="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
	<TopNavbar />

	<div class="flex min-h-0 flex-1">
		<LeftSidebar />

		<main class="flex min-w-0 flex-1 flex-col">
			<CanvasArea />
			<BottomToolbar />
		</main>

		<RightSidebar />
	</div>
</div>
