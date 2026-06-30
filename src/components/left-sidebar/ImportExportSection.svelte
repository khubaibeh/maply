<script lang="ts">
	import * as AlertDialog from "$lib/components/ui/alert-dialog";
	import { buttonVariants } from "$lib/components/ui/button";
	import * as Collapsible from "$lib/components/ui/collapsible";
	import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
	import { App } from "@app";
	import type { ProjectFilePackage } from "@app/types";
	import CaretDown from "phosphor-svelte/lib/CaretDown";
	import Download from "phosphor-svelte/lib/Download";
	import Upload from "phosphor-svelte/lib/Upload";

	const project = App.state.project;

	let importsOpen = $state(true);
	let importProjectDialogOpen = $state(false);
	let projectImportInputRef: HTMLInputElement | null = $state(null);
	let pendingImportedProject: ProjectFilePackage | null = null;
	let pendingImportedProjectName = $state("");
	let feedback = $state<{ tone: "success" | "error"; text: string } | null>(null);
	let busy = $state<"project-import" | "project-export" | "svg-export" | null>(null);
	let feedbackTimer: ReturnType<typeof setTimeout> | null = null;

	$effect(() => {
		if (!$project.initialized) return;
		importsOpen = $project.importExportState.importsOpen;
	});

	$effect(() => {
		if (!$project.initialized) return;
		App.actions.project.setImportExportState({ importsOpen });
	});

	function setFeedback(tone: "success" | "error", text: string) {
		if (feedbackTimer) {
			clearTimeout(feedbackTimer);
			feedbackTimer = null;
		}

		feedback = { tone, text };
		feedbackTimer = setTimeout(() => {
			feedback = null;
			feedbackTimer = null;
		}, 4000);
	}

	function formatError(error: unknown, fallback: string) {
		const message = error instanceof Error ? error.message : fallback;

		if (/not valid json/i.test(message)) return "This file is not valid JSON.";
		if (/unsupported project file format/i.test(message)) return "This file is not a Maply project export.";
		if (/unsupported project file version/i.test(message)) return "This project file uses an unsupported version.";
		if (/missing image asset data/i.test(message)) {
			return "This project file is incomplete because one or more image assets are missing.";
		}
		if (/duplicate image asset id/i.test(message)) {
			return "This project file is invalid because it contains duplicate image assets.";
		}

		return message;
	}

	function sanitizeDownloadName(name: string, extension: string) {
		const baseName = name
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "");
		return `${baseName || "maply-project"}.${extension}`;
	}

	function downloadTextFile(name: string, content: string, mimeType: string) {
		const blob = new Blob([content], { type: mimeType });
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = name;
		link.click();
		URL.revokeObjectURL(url);
	}

	function handleProjectExport() {
		if (busy) return;
		busy = "project-export";
		feedback = null;

		try {
			const projectFile = App.project.export();
			downloadTextFile(
				sanitizeDownloadName(projectFile.project.name, "json"),
				App.codec.project.stringify(projectFile),
				"application/json"
			);
			setFeedback("success", "Project exported as a portable JSON file.");
		} catch (error) {
			setFeedback("error", formatError(error, "Failed to export project."));
		} finally {
			busy = null;
		}
	}

	async function handleSvgExport() {
		if (busy) return;
		busy = "svg-export";
		feedback = null;

		try {
			const svg = await App.project.svg();
			downloadTextFile(sanitizeDownloadName($project.name, "svg"), svg, "image/svg+xml");
			setFeedback("success", "Standalone SVG exported with embedded assets and recovery metadata.");
		} catch (error) {
			setFeedback("error", formatError(error, "Failed to export SVG."));
		} finally {
			busy = null;
		}
	}

	function openProjectImportPicker() {
		projectImportInputRef?.click();
	}

	async function handleProjectImportFileChange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file || busy) return;
		busy = "project-import";
		feedback = null;

		try {
			pendingImportedProject = App.codec.project.parse(await file.text());
			pendingImportedProjectName = file.name;
			importProjectDialogOpen = true;
		} catch (error) {
			pendingImportedProject = null;
			pendingImportedProjectName = "";
			setFeedback("error", formatError(error, "Failed to read project file."));
		} finally {
			busy = null;
		}

		input.value = "";
	}

	async function confirmProjectImport() {
		if (!pendingImportedProject || busy) return;
		busy = "project-import";

		try {
			await App.project.import(pendingImportedProject);
			setFeedback("success", `Imported ${pendingImportedProjectName || "project file"}.`);
			importProjectDialogOpen = false;
			pendingImportedProject = null;
			pendingImportedProjectName = "";
		} catch (error) {
			setFeedback("error", formatError(error, "Failed to import project file."));
		} finally {
			busy = null;
		}
	}

	function cancelProjectImport() {
		importProjectDialogOpen = false;
		pendingImportedProject = null;
		pendingImportedProjectName = "";
	}
</script>

<div class={`flex flex-col ${importsOpen ? "border-border border-b" : ""}`}>
	<Collapsible.Root bind:open={importsOpen}>
		<Collapsible.Trigger
			class="border-border hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex h-8 w-full shrink-0 items-center justify-between border-b px-3 text-left outline-none"
		>
			<span class="text-sidebar-foreground/80 text-xs font-semibold tracking-wide uppercase">
				Import / Export
			</span>
			<CaretDown
				class="text-sidebar-foreground/70 size-4 transition-transform duration-200 {importsOpen
					? 'rotate-180'
					: ''}"
			/>
		</Collapsible.Trigger>
		<Collapsible.Content class="sidebar-collapsible-content">
			<div class="flex flex-col items-center gap-1.5 p-3">
				<input
					bind:this={projectImportInputRef}
					type="file"
					accept="application/json,.json"
					onchange={handleProjectImportFileChange}
					class="hidden"
				/>
				<DropdownMenu.Root>
					<DropdownMenu.Trigger
						class="{buttonVariants({
							variant: 'secondary',
							size: 'sm'
						})} h-7 w-32 justify-center gap-1.5 px-2 text-xs"
					>
						<Upload data-icon="inline-start" class="size-3" />
						Import
					</DropdownMenu.Trigger>
					<DropdownMenu.Content class="min-w-32">
						<DropdownMenu.Item class="justify-center text-center text-xs">SVG</DropdownMenu.Item>
						<DropdownMenu.Item class="justify-center text-center text-xs" onclick={openProjectImportPicker}
							>Project</DropdownMenu.Item
						>
					</DropdownMenu.Content>
				</DropdownMenu.Root>

				<DropdownMenu.Root>
					<DropdownMenu.Trigger
						class="{buttonVariants({
							variant: 'secondary',
							size: 'sm'
						})} h-7 w-32 justify-center gap-1.5 px-2 text-xs"
					>
						<Download data-icon="inline-start" class="size-3" />
						Export
					</DropdownMenu.Trigger>
					<DropdownMenu.Content class="min-w-32">
						<DropdownMenu.Item
							class="justify-center text-center text-xs"
							onclick={() => void handleSvgExport()}>SVG</DropdownMenu.Item
						>
						<DropdownMenu.Item class="justify-center text-center text-xs" onclick={handleProjectExport}
							>Project</DropdownMenu.Item
						>
					</DropdownMenu.Content>
				</DropdownMenu.Root>

				{#if feedback}
					<p
						class="px-1 text-center text-[11px] leading-4 {feedback.tone === 'error'
							? 'text-destructive'
							: 'text-muted-foreground'}"
					>
						{feedback.text}
					</p>
				{/if}
			</div>
		</Collapsible.Content>
	</Collapsible.Root>
</div>

<AlertDialog.Root bind:open={importProjectDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Replace current project?</AlertDialog.Title>
			<AlertDialog.Description>
				Importing {pendingImportedProjectName || "this project file"} will replace your current project. Save the
				existing project first if you want to keep it.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel onclick={cancelProjectImport} disabled={busy === "project-import"}
				>Cancel</AlertDialog.Cancel
			>
			<AlertDialog.Action onclick={() => void confirmProjectImport()} disabled={busy === "project-import"}
				>{busy === "project-import" ? "Importing..." : "Replace project"}</AlertDialog.Action
			>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<style>
	:global(.sidebar-collapsible-content) {
		overflow: hidden;
	}

	:global(.sidebar-collapsible-content[data-state="open"]) {
		animation: sidebar-collapse-down 200ms ease-out;
	}

	:global(.sidebar-collapsible-content[data-state="closed"]) {
		animation: sidebar-collapse-up 200ms ease-out;
	}

	@keyframes sidebar-collapse-down {
		from {
			height: 0;
			opacity: 0;
		}
		to {
			height: var(--bits-collapsible-content-height);
			opacity: 1;
		}
	}

	@keyframes sidebar-collapse-up {
		from {
			height: var(--bits-collapsible-content-height);
			opacity: 1;
		}
		to {
			height: 0;
			opacity: 0;
		}
	}
</style>
