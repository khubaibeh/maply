<script lang="ts">
	import { onMount } from 'svelte';
	import './layout.css';
	import './selections.css';
	import favicon from '$lib/assets/favicon.svg';
	import { getTheme } from '$lib/theme.svelte';
	import { projectState } from '$lib/state/project.svelte';

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
