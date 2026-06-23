<script lang="ts">
	import type { ElementNameValidation } from "$lib/app/core/element-name-validation";
	import { Button } from "$lib/components/ui/button";
	import * as Tooltip from "$lib/components/ui/tooltip";
	import TriangleAlert from "@lucide/svelte/icons/triangle-alert";

	let {
		validation,
		onAutofix,
		class: className = "",
		arrowClass = "hidden"
	}: {
		validation: ElementNameValidation;
		onAutofix: (suggestion: string) => void;
		class?: string;
		arrowClass?: string;
	} = $props();

	function applyAutofix() {
		if (!validation.suggestion) return;
		onAutofix(validation.suggestion);
	}

	const rules = $derived([
		{
			id: "start",
			text: "Start with a letter or underscore.",
			violated:
				validation.issues.includes("empty") ||
				validation.issues.includes("starts-with-number") ||
				validation.issues.includes("starts-with-hyphen")
		},
		{
			id: "characters",
			text: "Use only letters, numbers, underscores, or hyphens.",
			violated:
				validation.issues.includes("empty") ||
				validation.issues.includes("spaces") ||
				validation.issues.includes("invalid-symbols")
		},
		{
			id: "unique",
			text: "Keep names unique.",
			violated: validation.issues.includes("duplicate")
		}
	]);
</script>

<Tooltip.Root>
	<Tooltip.Trigger
		type="button"
		class="text-destructive hover:bg-destructive/10 focus-visible:ring-destructive/30 inline-flex size-5 shrink-0 items-center justify-center rounded-md outline-none focus-visible:ring-2 {className}"
		aria-label="Show element name validation details"
	>
		<TriangleAlert class="size-3.5" />
	</Tooltip.Trigger>
	<Tooltip.Content
		side="bottom"
		align="center"
		sideOffset={6}
		arrowClasses={arrowClass}
		class="bg-popover text-popover-foreground border-border w-72 max-w-72 flex-col items-stretch gap-2 border p-3 text-left shadow-lg"
	>
		<div class="flex flex-col gap-1">
			<p class="text-xs font-medium">Rules:</p>
			<ul class="flex flex-col gap-1 text-xs">
				{#each rules as rule (rule.id)}
					<li class="flex gap-2 {rule.violated ? 'text-destructive' : 'text-muted-foreground'}">
						<span class="w-3 shrink-0 text-center font-semibold">{rule.violated ? "×" : ""}</span>
						<span>{rule.text}</span>
					</li>
				{/each}
			</ul>
		</div>

		{#if validation.suggestion}
			<div class="border-border flex items-center justify-between gap-2 border-t pt-2">
				<div class="min-w-0 text-xs">
					<p class="text-muted-foreground">Autofix</p>
					<code class="block truncate">{validation.suggestion}</code>
				</div>
				<Button type="button" size="sm" variant="secondary" class="h-7 shrink-0 text-xs" onclick={applyAutofix}>
					Apply
				</Button>
			</div>
		{/if}
	</Tooltip.Content>
</Tooltip.Root>
