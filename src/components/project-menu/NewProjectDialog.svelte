<script lang="ts">
	import * as AlertDialog from "$lib/components/ui/alert-dialog";
	import { buttonVariants } from "$lib/components/ui/button";
	import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
	import { cn } from "$lib/utils";
	import { Editor } from "editor";
	import CaretDown from "phosphor-svelte/lib/CaretDown";

	let { open = $bindable(false), onError }: { open?: boolean; onError: (message: string) => void } = $props();

	async function create(elements: "sample" | "blank" = "blank") {
		try {
			const result = await Editor.project.create({ elements });
			if (!result.ok) return onError("A new project could not be created.");
			open = false;
		} catch {
			onError("A new project could not be created.");
		}
	}
</script>

<AlertDialog.Root bind:open>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Create new project?</AlertDialog.Title>
			<AlertDialog.Description
				>This replaces the current project with a fresh blank canvas unless you choose Sample Project. This
				action cannot be undone.</AlertDialog.Description
			>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<div class="flex items-center">
				<AlertDialog.Action class="rounded-r-none" onclick={() => void create()}>Create</AlertDialog.Action>
				<DropdownMenu.Root>
					<DropdownMenu.Trigger
						class={cn(
							buttonVariants({ variant: "default", size: "default" }),
							"-ml-1 rounded-l-none px-2!"
						)}
						aria-label="Create new project options"><CaretDown /></DropdownMenu.Trigger
					>
					<DropdownMenu.Content align="end" class="min-w-32 rounded-xl p-1">
						<DropdownMenu.Group
							><DropdownMenu.Item onclick={() => void create("sample")} class="text-xs"
								>Sample Project</DropdownMenu.Item
							></DropdownMenu.Group
						>
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			</div>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
