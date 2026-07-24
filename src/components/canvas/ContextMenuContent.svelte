<script lang="ts">
	import * as ContextMenu from "$lib/components/ui/context-menu";

	const itemClass = "rounded-lg px-2.5 py-1.5 text-xs";

	let {
		target,
		hasClipboardElement,
		canBringToFront,
		canBringForward,
		canSendBackward,
		canSendToBack,
		onCopy,
		onBringToFront,
		onBringForward,
		onSendBackward,
		onSendToBack,
		onDelete,
		onPaste,
		onSelectAll,
		hasElements
	}: {
		target: "element" | "empty";
		hasClipboardElement: boolean;
		hasElements: boolean;
		canBringToFront: boolean;
		canBringForward: boolean;
		canSendBackward: boolean;
		canSendToBack: boolean;
		onCopy: () => void;
		onBringToFront: () => void;
		onBringForward: () => void;
		onSendBackward: () => void;
		onSendToBack: () => void;
		onDelete: () => void;
		onPaste: () => void;
		onSelectAll: () => void;
	} = $props();
</script>

{#if target === "element"}
	<ContextMenu.Item class={itemClass} disabled={!hasElements} onclick={onSelectAll}>Select all</ContextMenu.Item>
	<ContextMenu.Separator />
	<ContextMenu.Item class={itemClass} onclick={onCopy}>Copy</ContextMenu.Item>
	<ContextMenu.Separator />
	<ContextMenu.Item class={itemClass} disabled={!canBringToFront} onclick={onBringToFront}>
		Bring to front
	</ContextMenu.Item>
	<ContextMenu.Item class={itemClass} disabled={!canBringForward} onclick={onBringForward}
		>Bring forward</ContextMenu.Item
	>
	<ContextMenu.Item class={itemClass} disabled={!canSendBackward} onclick={onSendBackward}
		>Send backward</ContextMenu.Item
	>
	<ContextMenu.Item class={itemClass} disabled={!canSendToBack} onclick={onSendToBack}>Send to back</ContextMenu.Item>
	<ContextMenu.Separator />
	<ContextMenu.Item class={itemClass} variant="destructive" onclick={onDelete}>Delete</ContextMenu.Item>
{:else}
	<ContextMenu.Item class={itemClass} disabled={!hasElements} onclick={onSelectAll}>Select all</ContextMenu.Item>
	<ContextMenu.Separator />
	<ContextMenu.Item class={itemClass} disabled={!hasClipboardElement} onclick={onPaste}>Paste</ContextMenu.Item>
{/if}
