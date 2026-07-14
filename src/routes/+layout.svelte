<script lang="ts">
	import favicon from "$lib/assets/favicon.svg";

	import "./layout.css";
	import "./selections.css";
	import * as Tooltip from "$lib/components/ui/tooltip";
	import { useTheme } from "$lib/state.svelte";
	import { canvasCursor } from "@components/core/cursors";
	import { Toaster } from "@components/core/toast";
	import { Editor } from "editor";
	import Monitor from "phosphor-svelte/lib/Monitor";
	import { onMount } from "svelte";

	let { children } = $props();

	let innerWidth = $state(0);
	let innerHeight = $state(0);
	let isClient = $state(false);
	let MIN_DIM = [400, 600];
	const canvas = Editor.state.canvas;
	const project = Editor.state.project;
	const theme = useTheme();

	let isTooSmall = $derived(isClient && (innerWidth < MIN_DIM[0] || innerHeight < MIN_DIM[1]));

	void theme;

	$effect(() => {
		const projectState = $project;
		const canvasState = $canvas;
		if (!projectState.initialized) return;

		// Layout owns autosave because it observes both project and canvas state.
		void canvasState;
		Editor.save.queue();
	});

	onMount(() => {
		isClient = true;

		// Expose the custom cursors as global CSS variables so layout.css can apply
		// them app-wide. (`<svelte:body>` doesn't support `style:` directives.)
		const root = document.documentElement;
		root.style.setProperty("--app-cursor-default", canvasCursor.default);
		root.style.setProperty("--app-cursor-hand", canvasCursor.hand);
		root.style.setProperty("--app-cursor-grabbing", canvasCursor.grabbing);
		root.style.setProperty("--app-cursor-text", canvasCursor.text);
		root.style.setProperty("--app-cursor-resize-horizontal", canvasCursor.resizeHorizontal);
		root.style.setProperty("--app-cursor-resize-vertical", canvasCursor.resizeVertical);
		root.style.setProperty("--app-cursor-resize-diagonal-down", canvasCursor.resizeDiagonalDown);
		root.style.setProperty("--app-cursor-resize-diagonal-up", canvasCursor.resizeDiagonalUp);

		const flushProjectSave = () => {
			void Editor.save.flush();
		};

		const handleVisibilityChange = () => {
			if (document.visibilityState === "hidden") {
				flushProjectSave();
			}
		};

		// Load once on the client and flush pending saves through browser shutdown paths.
		void Editor.load();
		window.addEventListener("pagehide", flushProjectSave);
		window.addEventListener("beforeunload", flushProjectSave);
		document.addEventListener("visibilitychange", handleVisibilityChange);

		return () => {
			window.removeEventListener("pagehide", flushProjectSave);
			window.removeEventListener("beforeunload", flushProjectSave);
			document.removeEventListener("visibilitychange", handleVisibilityChange);
		};
	});
</script>

<svelte:window bind:innerWidth bind:innerHeight />

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

{#if !isTooSmall}
	<Toaster />
	<Tooltip.Provider delayDuration={150}>
		{@render children()}
	</Tooltip.Provider>
{:else}
	<div
		class="bg-background/95 fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 p-6 text-center backdrop-blur-sm"
	>
		<Monitor class="text-muted-foreground size-12" />
		<h1 class="text-foreground text-xl font-semibold">Screen size not supported</h1>
		<p class="text-muted-foreground max-w-xs">
			This application requires a viewport of at least {MIN_DIM[0]}x{MIN_DIM[1]} pixels.
		</p>
	</div>
{/if}
