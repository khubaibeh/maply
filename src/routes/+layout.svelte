<script lang="ts">
	import favicon from "$lib/assets/favicon.svg";

	import "./layout.css";
	import "./selections.css";
	import * as Tooltip from "$lib/components/ui/tooltip";
	import { App } from "@app";
	import Monitor from "@lucide/svelte/icons/monitor";
	import { onMount } from "svelte";

	let { children } = $props();

	let innerWidth = $state(0);
	let innerHeight = $state(0);
	let isClient = $state(false);
	let MIN_DIM = [800, 600];
	const canvas = App.state.canvas;
	const project = App.state.project;
	const theme = App.state.theme;

	let isTooSmall = $derived(isClient && (innerWidth < MIN_DIM[0] || innerHeight < MIN_DIM[1]));

	void theme;

	$effect(() => {
		const projectState = $project;
		const canvasState = $canvas;
		if (!projectState.initialized) return;

		// Layout owns autosave because it observes both project and canvas state.
		void canvasState;
		App.save.queue();
	});

	onMount(() => {
		isClient = true;

		const flushProjectSave = () => {
			void App.save.flush();
		};

		const handleVisibilityChange = () => {
			if (document.visibilityState === "hidden") {
				flushProjectSave();
			}
		};

		// Load once on the client and flush pending saves through browser shutdown paths.
		void App.load();
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
