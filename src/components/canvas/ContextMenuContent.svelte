<script lang="ts">
	import * as ContextMenu from "$lib/components/ui/context-menu";

	const itemClass = "rounded-lg px-2.5 py-1.5 text-xs";

	let {
		target,
		hasClipboardElement,
		contextMenuElementIsFrontmost,
		contextMenuElementIsBackmost,
		onCopy,
		onBringToFront,
		onBringForward,
		onSendBackward,
		onSendToBack,
		onDelete,
		onPaste
	}: {
		target: "element" | "empty";
		hasClipboardElement: boolean;
		contextMenuElementIsFrontmost: boolean;
		contextMenuElementIsBackmost: boolean;
		onCopy: () => void;
		onBringToFront: () => void;
		onBringForward: () => void;
		onSendBackward: () => void;
		onSendToBack: () => void;
		onDelete: () => void;
		onPaste: () => void;
	} = $props();
</script>

{#if target === "element"}
	<ContextMenu.Item class={itemClass} onclick={onCopy}>Copy</ContextMenu.Item>
	<ContextMenu.Separator />
	<ContextMenu.Item class={itemClass} disabled={contextMenuElementIsFrontmost} onclick={onBringToFront}>
		Bring to front
	</ContextMenu.Item>
	<ContextMenu.Item class={itemClass} disabled={contextMenuElementIsFrontmost} onclick={onBringForward}
		>Bring forward</ContextMenu.Item
	>
	<ContextMenu.Item class={itemClass} disabled={contextMenuElementIsBackmost} onclick={onSendBackward}
		>Send backward</ContextMenu.Item
	>
	<ContextMenu.Item class={itemClass} disabled={contextMenuElementIsBackmost} onclick={onSendToBack}
		>Send to back</ContextMenu.Item
	>
	<ContextMenu.Separator />
	<ContextMenu.Item class={itemClass} variant="destructive" onclick={onDelete}>Delete</ContextMenu.Item>
{:else}
	<ContextMenu.Item class={itemClass} disabled={!hasClipboardElement} onclick={onPaste}>Paste</ContextMenu.Item>
{/if}
