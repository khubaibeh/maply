<script lang="ts">
	import CanvasArea from "$lib/components/canvas/CanvasArea.svelte";
	import { getClipboardElement, copyElement } from "$lib/state/clipboard.svelte";
	import { projectState } from "$lib/state/project.svelte";
	import type { Element } from "$lib/storage/schema";
	import { onMount } from "svelte";

	import BottomToolbar from "./BottomToolbar.svelte";
	import LeftSidebar from "./LeftSidebar.svelte";
	import RightSidebar from "./RightSidebar.svelte";
	import TopNavbar from "./TopNavbar.svelte";

	function isEditingText(event: KeyboardEvent): boolean {
		const target = event.target as HTMLElement | null;
		if (!target) return false;
		return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable;
	}

	function createId(): string {
		if (typeof crypto !== "undefined" && crypto.randomUUID) {
			return crypto.randomUUID();
		}
		return Math.random().toString(36).slice(2);
	}

	function offsetPastedElement(element: Element): Element {
		const next = structuredClone(element);
		next.id = createId();
		next.name = `${next.name} copy`;

		switch (next.type) {
			case "rect":
			case "text":
			case "image":
				next.x += 20;
				next.y += 20;
				break;
			case "circle":
				next.cx += 20;
				next.cy += 20;
				break;
			case "path":
				next.x += 20;
				next.y += 20;
				break;
		}

		return next;
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
				projectState.addElement(offsetPastedElement(copied));
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
