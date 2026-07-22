<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import type { Element } from "@maply/model/types";
	import { Editor } from "editor";
	import EyeIcon from "phosphor-svelte/lib/EyeIcon";
	import EyeSlashIcon from "phosphor-svelte/lib/EyeSlashIcon";
	import LinkBreakIcon from "phosphor-svelte/lib/LinkBreakIcon";
	import LinkIcon from "phosphor-svelte/lib/LinkIcon";
	import LockIcon from "phosphor-svelte/lib/LockIcon";
	import LockOpenIcon from "phosphor-svelte/lib/LockOpenIcon";

	import { getSharedElementState, type SharedElementState } from "./shared-properties";

	let { elements }: { elements: readonly Element[] } = $props();
	const states: readonly SharedElementState[] = ["locked", "bindable", "visible"];
	const ids = $derived(elements.map((element) => element.id));

	function value(state: SharedElementState) {
		return getSharedElementState(elements, state);
	}

	function update(state: SharedElementState) {
		const current = value(state);
		const next = current === null ? state !== "locked" : !current;

		switch (state) {
			case "locked":
				Editor.element.setLocked(ids, next);
				return;
			case "bindable":
				Editor.element.setBindable(ids, next);
				return;
			case "visible":
				Editor.element.setVisible(ids, next);
		}
	}
</script>

<div class="flex items-center gap-1">
	{#each states as state (state)}
		{@const stateValue = value(state)}
		{@const mixed = stateValue === null}
		<Button
			variant="ghost"
			size="icon-sm"
			class="text-sidebar-foreground/60 hover:text-sidebar-foreground rounded-md"
			aria-label={state === "locked" ? "Lock" : state === "bindable" ? "Bindable" : "Visible"}
			title={state === "locked" ? "Lock" : state === "bindable" ? "Bindable" : "Visible"}
			aria-pressed={stateValue ?? "mixed"}
			onclick={() => update(state)}
		>
			<span class="relative flex">
				{#if state === "locked"}
					{#if stateValue === true}<LockIcon data-icon="inline-start" />{:else}<LockOpenIcon
							data-icon="inline-start"
						/>{/if}
				{:else if state === "bindable"}
					{#if stateValue === false}<LinkBreakIcon data-icon="inline-start" />{:else}<LinkIcon
							data-icon="inline-start"
						/>{/if}
				{:else if stateValue === false}
					<EyeSlashIcon data-icon="inline-start" />
				{:else}
					<EyeIcon data-icon="inline-start" />
				{/if}
				{#if mixed}<span
						class="bg-primary ring-background absolute -top-0.5 -right-0.5 size-1.5 rounded-full ring-1"
					></span>{/if}
			</span>
		</Button>
	{/each}
</div>
