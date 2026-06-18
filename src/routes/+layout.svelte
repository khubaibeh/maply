<script lang="ts">
	import favicon from "$lib/assets/favicon.svg";

	import "./layout.css";
	import "./selections.css";
	import { projectState } from "$lib/state/project.svelte";
	import { getTheme } from "$lib/theme.svelte";
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
