<script lang="ts">
	import * as ContextMenu from "$lib/components/ui/context-menu";
	import type { Element } from "@maply/model/types";
	import { Editor } from "editor";

	let {
		element,
		frontmost,
		backmost,
		close
	}: { element: Element; frontmost: boolean; backmost: boolean; close: () => void } = $props();
	const project = Editor.state.project;
</script>

<ContextMenu.Content class="min-w-40 rounded-xl p-1">
	<ContextMenu.Group>
		<ContextMenu.Item
			class="rounded-lg px-2.5 py-1.5 text-xs"
			onclick={() => {
				Editor.selection.selectAll();
				close();
			}}>Select all</ContextMenu.Item
		>
	</ContextMenu.Group>
	<ContextMenu.Separator />
	<ContextMenu.Group>
		<ContextMenu.Item
			class="rounded-lg px-2.5 py-1.5 text-xs"
			onclick={() => {
				const selected = $project.selectedElementIds.includes(element.id)
					? $project.elements.filter((entry) => $project.selectedElementIds.includes(entry.id))
					: [element];
				Editor.clipboard.copy(selected);
				close();
			}}>Copy</ContextMenu.Item
		>
	</ContextMenu.Group>
	<ContextMenu.Separator />
	<ContextMenu.Group>
		<ContextMenu.Item
			class="rounded-lg px-2.5 py-1.5 text-xs"
			disabled={frontmost}
			onclick={() => {
				Editor.element.moveToFront(element.id);
				close();
			}}>Bring to front</ContextMenu.Item
		>
		<ContextMenu.Item
			class="rounded-lg px-2.5 py-1.5 text-xs"
			disabled={frontmost}
			onclick={() => {
				Editor.element.moveForward(element.id);
				close();
			}}>Bring forward</ContextMenu.Item
		>
		<ContextMenu.Item
			class="rounded-lg px-2.5 py-1.5 text-xs"
			disabled={backmost}
			onclick={() => {
				Editor.element.moveBackward(element.id);
				close();
			}}>Send backward</ContextMenu.Item
		>
		<ContextMenu.Item
			class="rounded-lg px-2.5 py-1.5 text-xs"
			disabled={backmost}
			onclick={() => {
				Editor.element.moveToBack(element.id);
				close();
			}}>Send to back</ContextMenu.Item
		>
	</ContextMenu.Group>
	<ContextMenu.Separator />
	<ContextMenu.Group>
		<ContextMenu.Item
			class="rounded-lg px-2.5 py-1.5 text-xs"
			variant="destructive"
			onclick={() => {
				const ids = $project.selectedElementIds.includes(element.id)
					? $project.selectedElementIds
					: [element.id];
				void Editor.element.delete(ids);
				close();
			}}>Delete</ContextMenu.Item
		>
	</ContextMenu.Group>
</ContextMenu.Content>
