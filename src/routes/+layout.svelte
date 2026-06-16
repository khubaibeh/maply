<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { getTheme } from '$lib/theme.svelte';

	let { children } = $props();

	getTheme();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{@render children()}
