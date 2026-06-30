<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import * as Tooltip from "$lib/components/ui/tooltip";
	import type { ElementNameValidation } from "@app/types";
	import Warning from "phosphor-svelte/lib/Warning";

	let {
		validation,
		onAutofix,
		class: className = "",
		arrowClass = "hidden",
		variant = "tooltip"
	}: {
		validation: ElementNameValidation;
		onAutofix: (suggestion: string) => void;
		class?: string;
		arrowClass?: string;
		variant?: "tooltip" | "inline";
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

{#snippet validationContent()}
	<div class="flex flex-col gap-1">
		{#if variant === "inline"}
			<div class="mt-3"></div>
		{/if}
		<p class="text-xs font-medium">Rules:</p>

		<ul class="flex flex-col gap-1 text-xs">
			{#each rules as rule (rule.id)}
				<li class="flex gap-2 {rule.violated ? 'text-destructive' : 'text-muted-foreground'}">
					<span class="w-3 shrink-0 text-center font-semibold">{rule.violated ? "×" : ""}</span>
					<span>{rule.text}</span>
				</li>
			{/each}
		</ul>

		{#if variant != "inline"}
			<div class="flex items-center justify-between gap-2 pt-6">
				<div class="min-w-0 text-xs">
					<p class="text-muted-foreground">Autofix</p>
					<code class="block truncate">{validation.suggestion}</code>
				</div>
				<Button type="button" size="sm" variant="secondary" class="h-7 shrink-0 text-xs" onclick={applyAutofix}>
					Apply
				</Button>
			</div>
		{/if}
	</div>
{/snippet}

{#if variant === "inline"}
	<div class="text-sidebar-foreground flex flex-col gap-2 pb-2 {className}">
		{@render validationContent()}
	</div>
{:else}
	<Tooltip.Root>
		<Tooltip.Trigger
			type="button"
			class="text-destructive hover:bg-destructive/10 focus-visible:ring-destructive/30 inline-flex size-5 shrink-0 items-center justify-center rounded-md outline-none focus-visible:ring-2 {className}"
			aria-label="Show element name validation details"
		>
			<Warning class="size-3.5" />
		</Tooltip.Trigger>
		<Tooltip.Content
			side="bottom"
			align="center"
			sideOffset={6}
			arrowClasses={arrowClass}
			class="bg-popover text-popover-foreground border-border w-72 max-w-72 flex-col items-stretch gap-2 p-3 text-left shadow-lg"
		>
			{@render validationContent()}
		</Tooltip.Content>
	</Tooltip.Root>
{/if}
