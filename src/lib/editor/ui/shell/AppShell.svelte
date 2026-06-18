<script lang="ts">
	import { duplicateElement } from "$lib/editor/actions/element-actions";
	import { getClipboardElement, copyElement } from "$lib/editor/state/clipboard.svelte";
	import { projectState } from "$lib/editor/state/project.svelte";
	import CanvasArea from "$lib/editor/ui/canvas/CanvasArea.svelte";
	import { onMount } from "svelte";

	import LeftSidebar from "../panels/LeftSidebar.svelte";
	import RightSidebar from "../panels/RightSidebar.svelte";
	import BottomToolbar from "../toolbar/BottomToolbar.svelte";
	import TopNavbar from "./TopNavbar.svelte";

	function isEditingText(event: KeyboardEvent): boolean {
		const target = event.target as HTMLElement | null;
		if (!target) return false;
		return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable;
	}

	onMount(() => {
		function handleKeyDown(event: KeyboardEvent) {
			if (!(event.ctrlKey || event.metaKey)) return;

			if (event.key === "c") {
				if (isEditingText(event)) return;
				const selected = projectState.selectedElement;
				if (!selected) return;

				event.preventDefault();
				copyElement(selected);
			} else if (event.key === "v") {
				if (isEditingText(event)) return;
				const copied = getClipboardElement();
				if (!copied) return;

				event.preventDefault();
				projectState.addElement(duplicateElement(copied));
			}
		}

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	});
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
