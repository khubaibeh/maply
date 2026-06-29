<script lang="ts">
	import * as ContextMenu from "$lib/components/ui/context-menu";

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
	<ContextMenu.Item onclick={onCopy}>Copy</ContextMenu.Item>
	<ContextMenu.Separator />
	<ContextMenu.Item disabled={contextMenuElementIsFrontmost} onclick={onBringToFront}>
		Bring to front
	</ContextMenu.Item>
	<ContextMenu.Item disabled={contextMenuElementIsFrontmost} onclick={onBringForward}>Bring forward</ContextMenu.Item>
	<ContextMenu.Item disabled={contextMenuElementIsBackmost} onclick={onSendBackward}>Send backward</ContextMenu.Item>
	<ContextMenu.Item disabled={contextMenuElementIsBackmost} onclick={onSendToBack}>Send to back</ContextMenu.Item>
	<ContextMenu.Separator />
	<ContextMenu.Item variant="destructive" onclick={onDelete}>Delete</ContextMenu.Item>
{:else}
	<ContextMenu.Item disabled={!hasClipboardElement} onclick={onPaste}>Paste</ContextMenu.Item>
{/if}
