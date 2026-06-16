<script lang="ts">
	import { onMount } from 'svelte';
	import { canvasState } from '$lib/state/canvas.svelte';
	import { toolState } from '$lib/state/tool.svelte';
	import CanvasBackground from './CanvasBackground.svelte';
	import CanvasArtboard from './CanvasArtboard.svelte';

	let container: HTMLDivElement | null = $state(null);
	let containerWidth = $state(0);
	let containerHeight = $state(0);
	let isPanning = $state(false);
	let isHovering = $state(false);
	let panStart = $state({ x: 0, y: 0 });
	let cameraStart = $state({ x: 0, y: 0 });

	const isHandActive = $derived(
		toolState.activeTool === 'hand' || (isHovering && toolState.isSpacePressed)
	);

	onMount(() => {
		if (!container) return;
		const viewport = container;

		const resizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const rect = entry.contentRect;
				containerWidth = rect.width;
				containerHeight = rect.height;
			}
		});

		resizeObserver.observe(container);

		const initialRect = container.getBoundingClientRect();
		containerWidth = initialRect.width;
		containerHeight = initialRect.height;
		canvasState.centerCamera(containerWidth, containerHeight);

		function handleWheel(event: WheelEvent) {
			event.preventDefault();

			if (event.ctrlKey || event.metaKey) {
				const ZOOM_SENSITIVITY = 0.005;
				const nextZoom = Math.min(
					canvasState.maxZoom,
					Math.max(
						canvasState.minZoom,
						canvasState.camera.zoom * Math.exp(-event.deltaY * ZOOM_SENSITIVITY)
					)
				);
				if (nextZoom === canvasState.camera.zoom) return;

				const rect = viewport.getBoundingClientRect();
				const mouseX = event.clientX - rect.left;
				const mouseY = event.clientY - rect.top;

				const worldX = canvasState.camera.x + mouseX / canvasState.camera.zoom;
				const worldY = canvasState.camera.y + mouseY / canvasState.camera.zoom;

				canvasState.setCamera({
					zoom: nextZoom,
					x: worldX - mouseX / nextZoom,
					y: worldY - mouseY / nextZoom
				});
			} else {
				canvasState.pan(
					event.deltaX / canvasState.camera.zoom,
					event.deltaY / canvasState.camera.zoom
				);
			}
		}

		function startPan(event: MouseEvent) {
			const canPan = event.button === 1 || (event.button === 0 && isHandActive);
			if (!canPan) return;

			event.preventDefault();
			viewport.focus();
			isPanning = true;
			panStart = { x: event.clientX, y: event.clientY };
			cameraStart = { x: canvasState.camera.x, y: canvasState.camera.y };
		}

		function movePan(event: MouseEvent) {
			if (!isPanning) return;
			const dx = (panStart.x - event.clientX) / canvasState.camera.zoom;
			const dy = (panStart.y - event.clientY) / canvasState.camera.zoom;
			canvasState.setCamera({
				x: cameraStart.x + dx,
				y: cameraStart.y + dy
			});
		}

		function endPan() {
			isPanning = false;
		}

		function handleKeyDown(event: KeyboardEvent) {
			if (event.key !== ' ') return;
			if (!isHovering) return;
			event.preventDefault();
			toolState.setSpacePressed(true);
		}

		function handleKeyUp(event: KeyboardEvent) {
			if (event.key !== ' ') return;
			event.preventDefault();
			toolState.setSpacePressed(false);
		}

		function handleMouseEnter() {
			isHovering = true;
		}

		function handleMouseLeave() {
			isHovering = false;
			toolState.setSpacePressed(false);
		}

		viewport.addEventListener('wheel', handleWheel, { passive: false });
		viewport.addEventListener('mousedown', startPan);
		viewport.addEventListener('mouseenter', handleMouseEnter);
		viewport.addEventListener('mouseleave', handleMouseLeave);
		window.addEventListener('mousemove', movePan);
		window.addEventListener('mouseup', endPan);
		window.addEventListener('keydown', handleKeyDown);
		window.addEventListener('keyup', handleKeyUp);

		return () => {
			resizeObserver.disconnect();
			viewport.removeEventListener('wheel', handleWheel);
			viewport.removeEventListener('mousedown', startPan);
			viewport.removeEventListener('mouseenter', handleMouseEnter);
			viewport.removeEventListener('mouseleave', handleMouseLeave);
			window.removeEventListener('mousemove', movePan);
			window.removeEventListener('mouseup', endPan);
			window.removeEventListener('keydown', handleKeyDown);
			window.removeEventListener('keyup', handleKeyUp);
		};
	});

	const viewBox = $derived(
		`${canvasState.camera.x} ${canvasState.camera.y} ${containerWidth / canvasState.camera.zoom} ${containerHeight / canvasState.camera.zoom}`
	);
</script>

<div
	bind:this={container}
	class="canvas-viewport relative min-h-0 flex-1 overflow-hidden bg-muted outline-none"
	class:panning={isPanning}
	class:hand={isHandActive}
	role="application"
	aria-label="Canvas workspace"
	tabindex="-1"
>
	{#if containerWidth > 0 && containerHeight > 0}
		<svg width="100%" height="100%" {viewBox} role="img" aria-label="Canvas workspace">
			<CanvasBackground {containerWidth} {containerHeight} camera={canvasState.camera} />
			<CanvasArtboard />
		</svg>
	{/if}
</div>

<style>
	.canvas-viewport {
		cursor: default;
	}

	.canvas-viewport.hand {
		cursor: grab;
	}

	.canvas-viewport.panning {
		cursor: grabbing;
	}
</style>
