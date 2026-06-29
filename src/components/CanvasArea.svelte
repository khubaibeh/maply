<script lang="ts">
	import * as ContextMenu from "$lib/components/ui/context-menu";
	import Artboard from "@components/canvas/Artboard.svelte";
	import Background from "@components/canvas/Background.svelte";
	import ContextMenuContent from "@components/canvas/ContextMenuContent.svelte";
	import DraftOverlay from "@components/canvas/DraftOverlay.svelte";
	import ImageCropToolbar from "@components/canvas/ImageCropToolbar.svelte";
	import { createCanvasAreaState } from "@components/core/area.state.svelte";

	const canvasArea = createCanvasAreaState();
</script>

<ContextMenu.Root bind:open={canvasArea.state.contextMenuOpen}>
	<ContextMenu.Trigger class="contents">
		<div
			bind:this={canvasArea.state.container}
			class="canvas-viewport bg-muted relative min-h-0 flex-1 overflow-hidden outline-none {canvasArea.cursorClass()}"
			style:cursor={canvasArea.toolCursor()}
			role="application"
			aria-label="Canvas workspace"
			tabindex="-1"
			oncontextmenu={canvasArea.handleContextMenu}
		>
			{#if canvasArea.state.containerWidth > 0 && canvasArea.state.containerHeight > 0}
				<svg
					bind:this={canvasArea.state.svgRef}
					width="100%"
					height="100%"
					viewBox={canvasArea.viewBox()}
					role="img"
					aria-label="Canvas workspace"
					onpointerdown={canvasArea.handleSvgPointerDown}
				>
					<Background
						containerWidth={canvasArea.state.containerWidth}
						containerHeight={canvasArea.state.containerHeight}
						camera={canvasArea.camera()}
					/>
					<Artboard />
					<DraftOverlay
						shapePreview={canvasArea.shapePreview()}
						pathSession={canvasArea.state.pathSession}
						pathPreviewRadius={canvasArea.pathPreviewRadius()}
						pathVertexRadius={canvasArea.pathVertexRadius()}
						onClosePath={canvasArea.closePath}
					/>
				</svg>
			{/if}
			{#if canvasArea.selectedImage() && canvasArea.state.containerWidth > 0 && canvasArea.state.containerHeight > 0}
				<ImageCropToolbar
					element={canvasArea.selectedImage()!}
					cropEditing={canvasArea.cropEditing()}
					containerWidth={canvasArea.state.containerWidth}
					containerHeight={canvasArea.state.containerHeight}
				/>
			{/if}
		</div>
	</ContextMenu.Trigger>
	<ContextMenu.Content>
		<ContextMenuContent
			target={canvasArea.state.contextMenuTarget}
			hasClipboardElement={canvasArea.hasClipboardElement()}
			contextMenuElementIsFrontmost={canvasArea.contextMenuElementIsFrontmost()}
			contextMenuElementIsBackmost={canvasArea.contextMenuElementIsBackmost()}
			onCopy={canvasArea.handleCopy}
			onBringToFront={canvasArea.handleBringToFront}
			onBringForward={canvasArea.handleBringForward}
			onSendBackward={canvasArea.handleSendBackward}
			onSendToBack={canvasArea.handleSendToBack}
			onDelete={canvasArea.handleDelete}
			onPaste={canvasArea.handlePaste}
		/>
	</ContextMenu.Content>
</ContextMenu.Root>
