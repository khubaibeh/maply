<script lang="ts">
	import { App } from "@app";
	import CanvasArea from "@components/CanvasArea.svelte";
	import Toolbar from "@components/core/Toolbar.svelte";
	import Topbar from "@components/core/Topbar.svelte";
	import LeftSidebar from "@components/LeftSidebar.svelte";
	import RightSidebar from "@components/RightSidebar.svelte";
	import { onMount } from "svelte";

	import {
		clamp,
		getArrowDelta,
		getShortcutTool,
		isEditingText,
		LEFT_SIDEBAR_MIN_WIDTH,
		MAIN_AREA_MIN_WIDTH,
		RESIZE_HANDLE_WIDTH,
		RIGHT_SIDEBAR_MIN_WIDTH,
		SIDEBAR_MAX_WIDTH_RATIO
	} from "./core.ts";

	const project = App.state.project;

	let layoutRef: HTMLDivElement | null = $state(null);
	let leftSidebarWidth = $state(LEFT_SIDEBAR_MIN_WIDTH);
	let rightSidebarWidth = $state(RIGHT_SIDEBAR_MIN_WIDTH);
	let activeResizeSide = $state<"left" | "right" | null>(null);

	function updateSidebarWidth(clientX: number) {
		if (!layoutRef || !activeResizeSide) return;

		const bounds = layoutRef.getBoundingClientRect();
		const layoutMaxLeftWidth = Math.max(
			LEFT_SIDEBAR_MIN_WIDTH,
			bounds.width - rightSidebarWidth - MAIN_AREA_MIN_WIDTH - RESIZE_HANDLE_WIDTH * 2
		);
		const layoutMaxRightWidth = Math.max(
			RIGHT_SIDEBAR_MIN_WIDTH,
			bounds.width - leftSidebarWidth - MAIN_AREA_MIN_WIDTH - RESIZE_HANDLE_WIDTH * 2
		);
		const maxLeftWidth = Math.min(layoutMaxLeftWidth, LEFT_SIDEBAR_MIN_WIDTH * SIDEBAR_MAX_WIDTH_RATIO);
		const maxRightWidth = Math.min(layoutMaxRightWidth, RIGHT_SIDEBAR_MIN_WIDTH * SIDEBAR_MAX_WIDTH_RATIO);

		if (activeResizeSide === "left") {
			leftSidebarWidth = clamp(clientX - bounds.left, LEFT_SIDEBAR_MIN_WIDTH, maxLeftWidth);
			return;
		}

		rightSidebarWidth = clamp(bounds.right - clientX, RIGHT_SIDEBAR_MIN_WIDTH, maxRightWidth);
	}

	function startSidebarResize(event: PointerEvent, side: "left" | "right") {
		if (event.button !== 0) return;
		event.preventDefault();
		activeResizeSide = side;
		updateSidebarWidth(event.clientX);
		document.body.style.cursor = "col-resize";
		document.body.style.userSelect = "none";
	}

	function stopSidebarResize() {
		if (!activeResizeSide) return;
		activeResizeSide = null;
		document.body.style.cursor = "";
		document.body.style.userSelect = "";
	}

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

		function handlePointerMove(event: PointerEvent) {
			updateSidebarWidth(event.clientX);
		}

		window.addEventListener("keydown", handleKeyDown);
		window.addEventListener("pointermove", handlePointerMove);
		window.addEventListener("pointerup", stopSidebarResize);
		window.addEventListener("pointercancel", stopSidebarResize);

		return () => {
			window.removeEventListener("keydown", handleKeyDown);
			window.removeEventListener("pointermove", handlePointerMove);
			window.removeEventListener("pointerup", stopSidebarResize);
			window.removeEventListener("pointercancel", stopSidebarResize);
			stopSidebarResize();
		};
	});
</script>

<div class="bg-background text-foreground flex h-screen w-screen flex-col gap-4 overflow-hidden p-4">
	<div>
		<Topbar />
	</div>

	<div bind:this={layoutRef} class="flex min-h-0 flex-1 gap-4">
		<div class="border-border bg-sidebar min-h-0 shrink-0 overflow-hidden rounded-2xl border">
			<LeftSidebar width={leftSidebarWidth} />
		</div>

		<div class="relative w-0 shrink-0 overflow-visible">
			<div
				class="group absolute inset-y-0 -left-1 z-10 w-2 cursor-col-resize touch-none bg-transparent outline-none"
				onpointerdown={(event) => startSidebarResize(event, "left")}
				role="separator"
				aria-label="Resize left sidebar"
				aria-orientation="vertical"
				aria-valuemin={LEFT_SIDEBAR_MIN_WIDTH}
				aria-valuenow={leftSidebarWidth}
			>
				<span
					class="bg-border/90 group-hover:bg-primary/45 absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-colors {activeResizeSide ===
					'left'
						? 'bg-primary/70'
						: ''}"
				></span>
			</div>
		</div>

		<div class="border-border bg-background min-w-0 flex-1 overflow-hidden rounded-[1.5rem] border">
			<main class="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
				<CanvasArea />
				<Toolbar />
			</main>
		</div>

		<div class="relative w-0 shrink-0 overflow-visible">
			<div
				class="group absolute inset-y-0 -left-1 z-10 w-2 cursor-col-resize touch-none bg-transparent outline-none"
				onpointerdown={(event) => startSidebarResize(event, "right")}
				role="separator"
				aria-label="Resize right sidebar"
				aria-orientation="vertical"
				aria-valuemin={RIGHT_SIDEBAR_MIN_WIDTH}
				aria-valuenow={rightSidebarWidth}
			>
				<span
					class="bg-border/90 group-hover:bg-primary/45 absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-colors {activeResizeSide ===
					'right'
						? 'bg-primary/70'
						: ''}"
				></span>
			</div>
		</div>

		<div class="border-border bg-sidebar min-h-0 shrink-0 overflow-hidden rounded-2xl border">
			<RightSidebar width={rightSidebarWidth} />
		</div>
	</div>
</div>
