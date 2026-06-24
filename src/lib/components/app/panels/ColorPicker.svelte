<script lang="ts">
	import { parseHexColor } from "$lib/app/domain/validation";
	import { Input } from "$lib/components/ui/input";

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
				aria-label="Pick {label.toLowerCase()}"
				class="absolute inset-0 size-full cursor-pointer opacity-0"
			/>
		</div>
		<Input
			{id}
			type="text"
			value={draft}
			oninput={updateFromTextInput}
			onblur={restoreCommittedColor}
			aria-invalid={invalid}
			class="h-7 text-xs focus-visible:ring-0 focus-visible:ring-offset-0 {invalid
				? 'border-destructive text-destructive aria-invalid:ring-0 dark:aria-invalid:ring-0'
				: ''}"
		/>
	</div>
</div>
