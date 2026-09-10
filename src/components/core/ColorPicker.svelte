<script lang="ts">
	import { Input } from "$lib/components/ui/input";
	import { parseHexColor } from "@maply/model";
	import { Editor } from "editor";
	import { onDestroy } from "svelte";

	let {
		id,
		label,
		value,
		onChange,
		class: className = ""
	}: {
		id: string;
		label: string;
		value: string;
		onChange: (color: string) => void;
		class?: string;
	} = $props();

	let draft = $state("");
	let lastId = $state("");
	let lastCommittedColor = $state("");
	let invalid = $state(false);
	let historyTransaction = $state<ReturnType<typeof Editor.history.begin> | null>(null);

	const colorInputValue = $derived(toSixDigitHex(value));

	$effect(() => {
		if (id === lastId && value === lastCommittedColor) return;
		lastId = id;
		draft = value.toUpperCase();
		lastCommittedColor = value.toUpperCase();
		invalid = false;
	});

	function toSixDigitHex(color: string) {
		const parsed = parseHexColor(color);
		if (parsed === null) return "#ffffff";

		if (parsed.length === 4) {
			const [, red, green, blue] = parsed;
			return `#${red}${red}${green}${green}${blue}${blue}`;
		}

		return parsed;
	}

	function updateDraft(nextDraft: string) {
		draft = nextDraft.toUpperCase();

		const color = parseHexColor(draft);
		if (color === null) {
			invalid = draft.trim().length > 0;
			return;
		}

		invalid = false;
		lastCommittedColor = color.toUpperCase();
		onChange(color.toUpperCase());
	}

	function updateFromNativePicker(event: Event) {
		updateDraft((event.target as HTMLInputElement).value);
	}

	function updateFromTextInput(event: Event) {
		updateDraft((event.target as HTMLInputElement).value);
	}

	function restoreCommittedColor() {
		if (parseHexColor(draft) !== null) return;
		draft = lastCommittedColor;
		invalid = false;
	}

	function beginHistory() {
		historyTransaction ??= Editor.history.begin();
	}

	function commitHistory() {
		Editor.history.commit(historyTransaction);
		historyTransaction = null;
	}

	function cancelHistory() {
		Editor.history.cancel(historyTransaction);
		historyTransaction = null;
	}

	onDestroy(commitHistory);
</script>

<div class="flex flex-col gap-1 {className}">
	<label for={id} class="text-sidebar-foreground/70 text-xs">{label}</label>
	<div class="flex items-center gap-2">
		<div
			class="border-border relative size-7 shrink-0 overflow-hidden rounded-xl border shadow-inner"
			style="background: {colorInputValue};"
		>
			<input
				type="color"
				value={colorInputValue}
				oninput={updateFromNativePicker}
				onpointerdown={beginHistory}
				onfocus={beginHistory}
				onpointerup={commitHistory}
				onpointercancel={cancelHistory}
				onchange={commitHistory}
				onblur={commitHistory}
				aria-label="Pick {label.toLowerCase()}"
				class="absolute inset-0 size-full cursor-pointer opacity-0"
			/>
		</div>
		<Input
			{id}
			type="text"
			value={draft}
			oninput={updateFromTextInput}
			onfocus={beginHistory}
			onblur={() => {
				restoreCommittedColor();
				commitHistory();
			}}
			aria-invalid={invalid}
			class="h-7 text-xs focus-visible:ring-0 focus-visible:ring-offset-0 {invalid
				? 'border-destructive text-destructive aria-invalid:ring-0 dark:aria-invalid:ring-0'
				: ''}"
		/>
	</div>
</div>
