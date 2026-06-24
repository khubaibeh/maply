<script lang="ts">
	import { duplicateElement } from "$lib/app/core/element-actions";
	import { getClipboardElement, copyElement } from "$lib/app/state/clipboard.svelte";
	import { projectState } from "$lib/app/state/project.svelte";
	import { onMount } from "svelte";

	import CanvasArea from "./canvas";
	import BottomToolbar from "./core/BottomToolbar.svelte";
	import TopNavbar from "./core/TopNavbar.svelte";
	import LeftSidebar from "./panels/LeftSidebar.svelte";
	import RightSidebar from "./panels/RightSidebar.svelte";

	function isEditingText(event: KeyboardEvent): boolean {
		const target = event.target as HTMLElement | null;
		if (!target) return false;
		return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable;
	}

	function getArrowDelta(key: string, step: number) {
		switch (key) {
			case "ArrowLeft":
				return { dx: -step, dy: 0 };
			case "ArrowRight":
				return { dx: step, dy: 0 };
			case "ArrowUp":
				return { dx: 0, dy: -step };
			case "ArrowDown":
				return { dx: 0, dy: step };
			default:
				return null;
		}
	}

	onMount(() => {
		function handleKeyDown(event: KeyboardEvent) {
			if (!isEditingText(event)) {
				const selectedId = $projectState.selectedElementId;
				const delta = getArrowDelta(event.key, event.shiftKey ? 10 : 1);

				if (selectedId && delta) {
					event.preventDefault();
					projectState.translateElement(selectedId, delta.dx, delta.dy);
					return;
				}
			}

			if (event.key === "Delete" || event.key === "Backspace") {
				if (isEditingText(event)) return;
				const selectedId = $projectState.selectedElementId;
				if (!selectedId) return;

				event.preventDefault();
				projectState.deleteElement(selectedId);
				return;
			}

			if (!(event.ctrlKey || event.metaKey)) return;

			if (event.key === "c") {
				if (isEditingText(event)) return;
				const selected = $projectState.elements.find(
					(element) => element.id === $projectState.selectedElementId
				);
				if (!selected) return;

				event.preventDefault();
				copyElement(selected);
			} else if (event.key === "v") {
				if (isEditingText(event)) return;
				const copied = getClipboardElement();
				if (!copied) return;

				event.preventDefault();
				projectState.addElement(duplicateElement(copied, $projectState.elements));
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
