<script lang="ts">
	import * as ContextMenu from "$lib/components/ui/context-menu";
	import type { Element } from "@maply/model/types";
	import { Editor } from "editor";
	import type { SelectionOrder } from "editor/types";

	let { element, close, onRename }: { element: Element; close: () => void; onRename: () => void } = $props();
	const project = Editor.state.project;
	const orderingIds = $derived(
		$project.selectedElementIds.includes(element.id) ? $project.selectedElementIds : [element.id]
	);
	const stateElements = $derived($project.elements.filter((entry) => orderingIds.includes(entry.id)));

	type ElementState = "locked" | "bindable" | "visible";

	function stateValue(entry: Element, state: ElementState): boolean {
		switch (state) {
			case "locked":
				return entry.locked ?? false;
			case "bindable":
				return entry.bindable ?? (entry.type === "rect" || entry.type === "circle" || entry.type === "path");
			case "visible":
				return entry.visible !== false;
		}
	}

	function stateStatus(state: ElementState) {
		const values = stateElements.map((entry) => stateValue(entry, state));
		const checked = values.every(Boolean);
		return { checked, indeterminate: !checked && values.some(Boolean) };
	}

	function canOrder(action: SelectionOrder) {
		return Editor.element.canReorder($project.elements, orderingIds, action);
	}

	function order(action: SelectionOrder) {
		if (action === "front") Editor.element.moveToFront(orderingIds);
		else if (action === "forward") Editor.element.moveForward(orderingIds);
		else if (action === "backward") Editor.element.moveBackward(orderingIds);
		else Editor.element.moveToBack(orderingIds);
		close();
	}
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
		<ContextMenu.Item
			class="rounded-lg px-2.5 py-1.5 text-xs"
			onclick={() => {
				close();
				onRename();
			}}>Rename</ContextMenu.Item
		>
	</ContextMenu.Group>
	<ContextMenu.Separator />
	<ContextMenu.Group>
		<ContextMenu.CheckboxItem
			class="rounded-lg px-2.5 py-1.5 text-xs"
			checked={stateStatus("locked").checked}
			indeterminate={stateStatus("locked").indeterminate}
			onCheckedChange={(locked) => Editor.element.setLocked(orderingIds, locked)}>Locked</ContextMenu.CheckboxItem
		>
		<ContextMenu.CheckboxItem
			class="rounded-lg px-2.5 py-1.5 text-xs"
			checked={stateStatus("bindable").checked}
			indeterminate={stateStatus("bindable").indeterminate}
			onCheckedChange={(bindable) => Editor.element.setBindable(orderingIds, bindable)}
			>Bindable</ContextMenu.CheckboxItem
		>
		<ContextMenu.CheckboxItem
			class="rounded-lg px-2.5 py-1.5 text-xs"
			checked={stateStatus("visible").checked}
			indeterminate={stateStatus("visible").indeterminate}
			onCheckedChange={(visible) => Editor.element.setVisible(orderingIds, visible)}
			>Visible</ContextMenu.CheckboxItem
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
		<ContextMenu.Item
			class="rounded-lg px-2.5 py-1.5 text-xs"
			disabled={Editor.clipboard.get().length === 0}
			onclick={() => {
				void Editor.clipboard.paste();
				close();
			}}>Paste</ContextMenu.Item
		>
	</ContextMenu.Group>
	<ContextMenu.Separator />
	<ContextMenu.Group>
		<ContextMenu.Item
			class="rounded-lg px-2.5 py-1.5 text-xs"
			disabled={!canOrder("front")}
			onclick={() => order("front")}>Bring to front</ContextMenu.Item
		>
		<ContextMenu.Item
			class="rounded-lg px-2.5 py-1.5 text-xs"
			disabled={!canOrder("forward")}
			onclick={() => order("forward")}>Bring forward</ContextMenu.Item
		>
		<ContextMenu.Item
			class="rounded-lg px-2.5 py-1.5 text-xs"
			disabled={!canOrder("backward")}
			onclick={() => order("backward")}>Send backward</ContextMenu.Item
		>
		<ContextMenu.Item
			class="rounded-lg px-2.5 py-1.5 text-xs"
			disabled={!canOrder("back")}
			onclick={() => order("back")}>Send to back</ContextMenu.Item
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
