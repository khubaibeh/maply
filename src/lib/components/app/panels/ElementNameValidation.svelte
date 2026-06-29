<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import * as Tooltip from "$lib/components/ui/tooltip";
	import type { ElementNameValidation } from "@app/types";
	import ChevronDown from "@lucide/svelte/icons/chevron-down";
	import TriangleAlert from "@lucide/svelte/icons/triangle-alert";
	import { SvelteMap } from "svelte/reactivity";

	const inlineRulesOpenByKey = new SvelteMap<string, boolean>();

	let {
		validation,
		onAutofix,
		class: className = "",
		arrowClass = "hidden",
		variant = "tooltip",
		stateKey = validation.id
	}: {
		validation: ElementNameValidation;
		onAutofix: (suggestion: string) => void;
		class?: string;
		arrowClass?: string;
		variant?: "tooltip" | "inline";
		stateKey?: string;
	} = $props();

	let inlineRulesOpen = $derived(inlineRulesOpenByKey.get(stateKey) ?? true);

	function applyAutofix() {
		if (!validation.suggestion) return;
		onAutofix(validation.suggestion);
	}

	function toggleInlineRules() {
		inlineRulesOpen = !inlineRulesOpen;
		inlineRulesOpenByKey.set(stateKey, inlineRulesOpen);
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

{#snippet validationContent(showRulesTrigger = false)}
	<div class="flex flex-col gap-1">
		{#if showRulesTrigger}
			<button
				type="button"
				class="text-foreground hover:text-destructive flex items-center justify-between gap-2 text-left text-xs font-medium outline-none"
				onclick={toggleInlineRules}
				aria-expanded={inlineRulesOpen}
			>
				<span>Rules:</span>
				<ChevronDown
					class="text-muted-foreground size-3.5 transition-transform duration-150 {inlineRulesOpen
						? 'rotate-180'
						: ''}"
				/>
			</button>
		{:else}
			<p class="text-xs font-medium">Rules:</p>
		{/if}
		{#if !showRulesTrigger || inlineRulesOpen}
			<ul class="flex flex-col gap-1 text-xs">
				{#each rules as rule (rule.id)}
					<li class="flex gap-2 {rule.violated ? 'text-destructive' : 'text-muted-foreground'}">
						<span class="w-3 shrink-0 text-center font-semibold">{rule.violated ? "×" : ""}</span>
						<span>{rule.text}</span>
					</li>
				{/each}
			</ul>

			{#if validation.suggestion}
				<div class="border-border flex items-center justify-between gap-2 border-t pt-2">
					<div class="min-w-0 text-xs">
						<p class="text-muted-foreground">Autofix</p>
						<code class="block truncate">{validation.suggestion}</code>
					</div>
					<Button
						type="button"
						size="sm"
						variant="secondary"
						class="h-7 shrink-0 text-xs"
						onclick={applyAutofix}
					>
						Apply
					</Button>
				</div>
			{/if}
		{/if}
	</div>
{/snippet}

{#if variant === "inline"}
	<div class="bg-sidebar text-sidebar-foreground border-border flex flex-col gap-2 border-b pb-2 {className}">
		{@render validationContent(true)}
	</div>
{:else}
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
			{@render validationContent()}
		</Tooltip.Content>
	</Tooltip.Root>
{/if}
