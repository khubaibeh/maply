<script lang="ts">
	import * as ContextMenu from "$lib/components/ui/context-menu";
	import Artboard from "@components/canvas/Artboard.svelte";
	import Background from "@components/canvas/Background.svelte";
	import ContextMenuContent from "@components/canvas/ContextMenuContent.svelte";
	import DraftOverlay from "@components/canvas/DraftOverlay.svelte";
	import ImageCropToolbar from "@components/canvas/ImageCropToolbar.svelte";
	import MarqueeSelectionOverlay from "@components/canvas/MarqueeSelectionOverlay.svelte";
	import MarqueeSelectionPreview from "@components/canvas/MarqueeSelectionPreview.svelte";
	import { createCanvasAreaState } from "@components/core/canvas-area/area.state.svelte";
	import { canvasCursor } from "@components/core/cursors";
	import { Editor } from "editor";

	const canvasArea = createCanvasAreaState();
	const project = Editor.state.project;
</script>

<ContextMenu.Root bind:open={canvasArea.contextMenu.state.open}>
	<ContextMenu.Trigger class="contents">
		<div
			bind:this={canvasArea.state.container}
			class="canvas-viewport bg-muted relative min-h-0 flex-1 overflow-hidden outline-none"
			style:cursor={canvasArea.toolCursor() ?? canvasArea.cursorClass()}
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
					<MarqueeSelectionPreview elements={canvasArea.marquee.state.candidates} />
					<MarqueeSelectionOverlay box={canvasArea.marquee.state.box} />
					<DraftOverlay
						shapePreview={canvasArea.shapePreview()}
						pathSession={canvasArea.path.state.session}
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
	<ContextMenu.Content
		class="canvas-default-cursor min-w-40 rounded-xl p-1"
		style={`cursor: ${canvasCursor.default}`}
	>
		<ContextMenuContent
			target={canvasArea.contextMenu.state.target}
			hasClipboardElement={canvasArea.contextMenu.hasClipboardElement()}
			hasElements={$project.elements.length > 0}
			contextMenuElementIsFrontmost={canvasArea.contextMenu.isFrontmost()}
			contextMenuElementIsBackmost={canvasArea.contextMenu.isBackmost()}
			onCopy={canvasArea.contextMenu.copy}
			onBringToFront={canvasArea.contextMenu.bringToFront}
			onBringForward={canvasArea.contextMenu.bringForward}
			onSendBackward={canvasArea.contextMenu.sendBackward}
			onSendToBack={canvasArea.contextMenu.sendToBack}
			onDelete={canvasArea.contextMenu.remove}
			onPaste={canvasArea.contextMenu.paste}
			onSelectAll={canvasArea.contextMenu.selectAll}
		/>
	</ContextMenu.Content>
</ContextMenu.Root>
