<script lang="ts">
	import { App } from "@app";
	import CanvasArea from "@components/CanvasArea.svelte";
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

	onMount(() => {
		function handleKeyDown(event: KeyboardEvent) {
			if (!isEditingText(event) && !event.ctrlKey && !event.metaKey && !event.altKey) {
				const shortcutTool = getShortcutTool(event.key);
				if (shortcutTool) {
					event.preventDefault();
					App.actions.tool.set(shortcutTool);
					return;
				}
			}

			if (!isEditingText(event)) {
				const selectedId = $project.selectedElementId;
				const delta = getArrowDelta(event.key, event.shiftKey ? 10 : 1);

				if (selectedId && delta) {
					event.preventDefault();
					App.actions.project.translateElement(selectedId, delta.dx, delta.dy);
					return;
				}
			}

			if (event.key === "Delete" || event.key === "Backspace") {
				if (isEditingText(event)) return;
				const selectedId = $project.selectedElementId;
				if (!selectedId) return;

				event.preventDefault();
				void App.element.delete(selectedId);
				return;
			}

			if (!(event.ctrlKey || event.metaKey)) return;

			if (event.key === "c") {
				if (isEditingText(event)) return;
				const selected = $project.elements.find((element) => element.id === $project.selectedElementId);
				if (!selected) return;

				event.preventDefault();
				App.actions.clipboard.copy(selected);
			} else if (event.key === "v") {
				if (isEditingText(event)) return;
				const copied = App.actions.clipboard.get();
				if (!copied) return;

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
		<div class="border-border bg-sidebar min-h-0 shrink-0 overflow-hidden rounded-2xl border">
			<LeftSidebar width={LEFT_SIDEBAR_MIN_WIDTH} />
		</div>

		<div class="border-border bg-background min-w-0 flex-1 overflow-hidden rounded-[1.5rem] border">
			<main class="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden">
				<CanvasArea />
				<Toolbar class="absolute inset-x-0 bottom-4 z-10 mx-auto w-fit" />
			</main>
		</div>

		<div class="border-border bg-sidebar min-h-0 shrink-0 overflow-hidden rounded-2xl border">
			<RightSidebar width={RIGHT_SIDEBAR_MIN_WIDTH} />
		</div>
	</div>
</div>
