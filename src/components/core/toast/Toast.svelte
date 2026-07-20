<script lang="ts">
	import { cn } from "$lib/utils";
	import CheckCircle from "phosphor-svelte/lib/CheckCircle";
	import Info from "phosphor-svelte/lib/Info";
	import XCircle from "phosphor-svelte/lib/XCircle";
	import { onMount } from "svelte";
	import { fly } from "svelte/transition";

	import { toast as toastState, TOAST_DURATION, type Toast } from "./toast.state.svelte";

	let { toast }: { toast: Toast } = $props();

	onMount(() => {
		const timer = setTimeout(() => toastState.remove(toast.id), TOAST_DURATION);
		return () => clearTimeout(timer);
	});
</script>

<div
	role="status"
	transition:fly={{ x: -12, duration: 160 }}
	class={cn(
		"text-foreground pointer-events-none flex max-w-86 min-w-64 items-center gap-3 rounded-2xl border px-3 py-2.5 text-sm shadow-xl backdrop-blur-md",
		toast.kind === "success" && "border-primary/45 bg-primary/15 dark:bg-primary/20",
		toast.kind === "error" && "border-destructive/35 bg-destructive/10 dark:bg-destructive/15",
		toast.kind === "info" && "border-muted-foreground/25 bg-muted/90 dark:bg-muted/70"
	)}
>
	{#if toast.kind === "success"}
		<CheckCircle class="text-primary size-4 shrink-0" weight="fill" />
	{:else if toast.kind === "error"}
		<XCircle class="text-destructive size-4 shrink-0" weight="fill" />
	{:else}
		<Info class="text-muted-foreground size-4 shrink-0" weight="fill" />
	{/if}
	<span class="leading-snug font-medium">{toast.message}</span>
</div>
