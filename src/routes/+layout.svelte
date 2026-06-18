<script lang="ts">
	import { getTheme } from "$lib/app/theme.svelte";

	import "./layout.css";
	import "./selections.css";
	import favicon from "$lib/assets/favicon.svg";
	import { canvasState } from "$lib/editor/state/canvas.svelte";
	import { projectState } from "$lib/editor/state/project.svelte";
	import { onMount } from "svelte";

	let { children } = $props();

	getTheme();

	$effect(() => {
		if (!$projectState.initialized) return;

		projectState.queueSave({
			id: $projectState.id,
			name: $projectState.name,
			canvas: {
				width: $canvasState.width,
				height: $canvasState.height,
				x: $canvasState.x,
				y: $canvasState.y
			},
			camera: {
				x: $canvasState.camera.x,
				y: $canvasState.camera.y,
				zoom: $canvasState.camera.zoom
			},
			elements: $projectState.elements.map((element) => ({ ...element })),
			importExportState: {
				importsOpen: $projectState.importExportState.importsOpen,
				elementsOpen: $projectState.importExportState.elementsOpen
			}
		});
	});

	onMount(() => {
		const flushProjectSave = () => {
			void projectState.saveNow();
		};

		const handleVisibilityChange = () => {
			if (document.visibilityState === "hidden") {
				flushProjectSave();
			}
		};

		void projectState.load();
		window.addEventListener("pagehide", flushProjectSave);
		window.addEventListener("beforeunload", flushProjectSave);
		document.addEventListener("visibilitychange", handleVisibilityChange);

		return () => {
			window.removeEventListener("pagehide", flushProjectSave);
			window.removeEventListener("beforeunload", flushProjectSave);
			document.removeEventListener("visibilitychange", handleVisibilityChange);
		};
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{@render children()}
