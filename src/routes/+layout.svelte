<script lang="ts">
	import { canvasState } from "$lib/app/state/canvas.svelte";
	import { projectState } from "$lib/app/state/project.svelte";

	import "./layout.css";
	import "./selections.css";
	import { getTheme } from "$lib/app/theme.svelte";
	import favicon from "$lib/assets/favicon.svg";
	import * as Tooltip from "$lib/components/ui/tooltip";
	import { onMount } from "svelte";

	let { children } = $props();

	getTheme();

	$effect(() => {
		if (!$projectState.initialized) return;

		// Layout owns autosave because it observes both project and canvas state.
		projectState.queueSave({
			id: $projectState.id,
			name: $projectState.name,
			canvas: {
				width: $canvasState.width,
				height: $canvasState.height,
				color: $canvasState.color,
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

		// Load once on the client and flush pending saves through browser shutdown paths.
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
<Tooltip.Provider delayDuration={150}>
	{@render children()}
</Tooltip.Provider>
