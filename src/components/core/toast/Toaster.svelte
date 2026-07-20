<script lang="ts">
	import { toast } from "./toast.state.svelte";
	import Toast from "./Toast.svelte";
</script>

<div class="pointer-events-none fixed bottom-4 left-4 z-50 flex flex-col gap-2" aria-live="polite" aria-atomic="true">
	{#each toast.toasts as item (item.id)}
		<Toast toast={item} />
	{/each}
</div>
