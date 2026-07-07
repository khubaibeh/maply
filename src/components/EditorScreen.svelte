<script lang="ts">
	import { App } from "@app";
	import CanvasArea from "@components/CanvasArea.svelte";
	import ProjectMenuOverlay from "@components/core/ProjectMenuOverlay.svelte";
	import Toolbar from "@components/core/Toolbar.svelte";
	import Topbar from "@components/core/Topbar.svelte";
	import LeftSidebar from "@components/LeftSidebar.svelte";
	import RightSidebar from "@components/RightSidebar.svelte";
	import { onMount } from "svelte";

	import {
		getArrowDelta,
		getShortcutTool,
		isEditingText,
		LEFT_SIDEBAR_MIN_WIDTH,
		RIGHT_SIDEBAR_MIN_WIDTH
	} from "./core.ts";

	const project = App.state.project;

	function getSelectedElements() {
		return $project.elements.filter((element) => $project.selectedElementIds.includes(element.id));
	}

	onMount(() => {
		function handleKeyDown(event: KeyboardEvent) {
			if (event.defaultPrevented) return;

			if (!isEditingText(event) && !event.ctrlKey && !event.metaKey && !event.altKey) {
				const shortcutTool = getShortcutTool(event.key);
				if (shortcutTool) {
					event.preventDefault();
					App.actions.tool.set(shortcutTool);
					return;
				}
			}

			if (event.key === "Escape") {
				if (isEditingText(event)) return;
				if ($project.selectedElementIds.length === 0) return;

				event.preventDefault();
				App.actions.project.selectElement(null);
				return;
			}

			if (!isEditingText(event)) {
				const selectedId = $project.selectedElementIds.length === 1 ? $project.selectedElementId : null;
				const delta = getArrowDelta(event.key, event.shiftKey ? 10 : 1);

				if (selectedId && delta) {
					event.preventDefault();
					App.actions.project.translateElement(selectedId, delta.dx, delta.dy);
					return;
				}
			}

			if (event.key === "Delete" || event.key === "Backspace") {
				if (isEditingText(event)) return;
				const selectedIds = $project.selectedElementIds;
				if (selectedIds.length === 0) return;

				event.preventDefault();
				void App.element.delete(selectedIds);
				return;
			}

			if (!(event.ctrlKey || event.metaKey)) return;

			if (event.key === "c") {
				if (isEditingText(event)) return;
				const selected = getSelectedElements();
				if (selected.length === 0) return;

				event.preventDefault();
				App.actions.clipboard.copy(selected);
			} else if (event.key === "a") {
				if (isEditingText(event)) return;
				if ($project.elements.length === 0) return;

				event.preventDefault();
				App.actions.project.selectAll();
			} else if (event.key === "v") {
				if (isEditingText(event)) return;
				const copied = App.actions.clipboard.get();
				if (copied.length === 0) return;

				event.preventDefault();
				void App.element.paste();
			}
		}

		window.addEventListener("keydown", handleKeyDown);

		return () => {
			window.removeEventListener("keydown", handleKeyDown);
		};
	});
</script>

<div class="bg-background text-foreground flex h-screen w-screen flex-col gap-4 overflow-hidden p-4">
	<div>
		<Topbar />
	</div>

	<div class="flex min-h-0 flex-1 gap-4">
		<LeftSidebar width={LEFT_SIDEBAR_MIN_WIDTH} />

		<div class="border-border bg-background min-w-0 flex-1 overflow-hidden rounded-[1.5rem] border">
			<main class="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden">
				<ProjectMenuOverlay class="top-4 left-4" />
				<CanvasArea />
				<Toolbar class="absolute inset-x-0 bottom-4 z-10 mx-auto w-fit" />
			</main>
		</div>

		<div class="border-border/50 bg-sidebar/5 min-h-0 shrink-0 overflow-hidden rounded-2xl border">
			<RightSidebar width={RIGHT_SIDEBAR_MIN_WIDTH} />
		</div>
	</div>
</div>
