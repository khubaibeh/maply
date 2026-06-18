<script lang="ts">
	import { getTheme } from "$lib/app/theme.svelte";

	import "./layout.css";
	import "./selections.css";
	import favicon from "$lib/assets/favicon.svg";
	import { projectState } from "$lib/editor/state/project.svelte";
	import { onMount } from "svelte";

	let { children } = $props();

	getTheme();

	onMount(() => {
		projectState.load();
	});

	$effect(() => {
		if (!projectState.initialized) return;
		projectState.queueSave();
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{@render children()}
