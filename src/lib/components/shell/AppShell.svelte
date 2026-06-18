<script lang="ts">
	import CanvasArea from "$lib/components/canvas/CanvasArea.svelte";

	import BottomToolbar from "./BottomToolbar.svelte";
	import LeftSidebar from "./LeftSidebar.svelte";
	import RightSidebar from "./RightSidebar.svelte";
	import TopNavbar from "./TopNavbar.svelte";
</script>

<div class="bg-background text-foreground flex h-screen w-screen flex-col overflow-hidden">
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
