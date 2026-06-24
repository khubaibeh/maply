<script lang="ts">
	import { duplicateElement } from "$lib/app/core/element-actions";
	import { getClipboardElement, copyElement } from "$lib/app/state/clipboard.svelte";
	import { projectState } from "$lib/app/state/project.svelte";
	import { toolState, type Tool } from "$lib/app/state/tool.svelte";
	import { onMount } from "svelte";

	import CanvasArea from "./canvas";
	import BottomToolbar from "./core/BottomToolbar.svelte";
	import TopNavbar from "./core/TopNavbar.svelte";
	import LeftSidebar from "./panels/LeftSidebar.svelte";
	import RightSidebar from "./panels/RightSidebar.svelte";

	const LEFT_SIDEBAR_MIN_WIDTH = 240;
	const RIGHT_SIDEBAR_MIN_WIDTH = 288;
	const SIDEBAR_MAX_WIDTH_RATIO = 1.75;
	const MAIN_AREA_MIN_WIDTH = 480;
	const RESIZE_HANDLE_WIDTH = 8;

	let layoutRef: HTMLDivElement | null = $state(null);
	let leftSidebarWidth = $state(LEFT_SIDEBAR_MIN_WIDTH);
	let rightSidebarWidth = $state(RIGHT_SIDEBAR_MIN_WIDTH);
	let activeResizeSide = $state<"left" | "right" | null>(null);

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

	function getShortcutTool(key: string): Tool | null {
		switch (key.toLowerCase()) {
			case "v":
				return "select";
			case "h":
				return "hand";
			case "r":
				return "rect";
			case "c":
				return "circle";
			case "p":
				return "path";
			case "t":
				return "text";
			case "i":
				return "image";
			default:
				return null;
		}
	}

	function clamp(value: number, min: number, max: number) {
		return Math.min(Math.max(value, min), max);
	}

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
					toolState.setTool(shortcutTool);
					return;
				}
			}

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

<div class="bg-background text-foreground flex h-screen w-screen flex-col overflow-hidden">
	<TopNavbar />

	<div bind:this={layoutRef} class="flex min-h-0 flex-1">
		<LeftSidebar width={leftSidebarWidth} />

		<div class="relative w-0 shrink-0 overflow-visible">
			<button
				type="button"
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
			</button>
		</div>

		<main class="flex min-w-0 flex-1 flex-col">
			<CanvasArea />
			<BottomToolbar />
		</main>

		<div class="relative w-0 shrink-0 overflow-visible">
			<button
				type="button"
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
			</button>
		</div>

		<RightSidebar width={rightSidebarWidth} />
	</div>
</div>
