# Editor Workflows

This is the behavior inventory for the `app/` to `editor/` migration. It records user-visible workflows, their current implementation, invariants to retain, and their intended ownership after migration.

`editor/` owns live Maply editing state and commands. `src/` owns UI rendering, browser events, dialogs, file pickers, downloads, and pointer interaction. `@maply/model`, `@maply/io`, and `@maply/storage` own reusable model, external-format, and persistence capabilities.

## Migration Status

The active Svelte UI uses the public `Editor` surface. Compatibility implementations preserve legacy behavior under `editor/compat` without modifying internal editor modules.

Done in `editor/`:

- Session load/save with `@maply/storage`.
- Project rename/create plus project-file and SVG import/export composition with `@maply/io` and `@maply/storage`.
- Canvas frame/color/camera commands and tool state.
- Element creation, mutation, resize, text/path helpers, naming validation, ordering, selection, deletion, and clipboard.
- Image upload/replacement and crop commands, including atomic project/asset replacement through storage.

Remaining follow-up work:

- Keep UI-only workflows in `src`: pointer draft state, DOM events, dialogs, file picker/download mechanics, and theme preference.
- Complete generic SVG import diagnostics.
- Remove `importExportState` after persisted compatibility is handled.

## Session Lifecycle

### Load editor session

Entry: `src/routes/+layout.svelte` calls `Editor.load()` when mounted.

Current flow: `app/internal/lifecycle.ts` delegates to `app/store/project.ts`. The store fetches the active project, applies canvas and camera state, normalizes and clamps elements, then loads assets referenced by image elements.

Invariants: loading clears selection, hover, and crop editing state. A failed load keeps startup defaults and clears the in-memory asset cache. Initialization completes only after this workflow so startup defaults cannot overwrite persisted work.

Editor status: implemented by `editor/session/load.ts` using `@maply/storage`.

### Autosave and flush

Entry: the layout observes initialized project and canvas stores. Browser `pagehide`, `beforeunload`, and hidden-document events flush pending work. An unrendered legacy sidebar also exposes an explicit save control.

Current flow: `app/internal/save.ts` serializes `appProjectState.toProject()` after a 500ms debounce. It refuses all saves before initialization and only logs persistence failures.

Invariants: queueing a save replaces the previous debounce. Flushing cancels a pending debounce before saving. Canvas changes are persisted together with project fields and elements.

Editor status: implemented by `editor/session/save.ts`; the layout still owns browser event registration and store observation after UI migration.

## Project Workflows

### Rename project

Entry: project-name controls in `src/components/project-menu/ProjectMenuOverlay.svelte`.

Current flow: Enter or blur commits the name; Escape restores the displayed value. `app/store/project.ts` updates the live name and normal autosave persists it.

Editor status: implemented by `Editor.project.rename`.

### Create blank or sample project

Entry: the project menu confirmation dialog.

Current flow: `App.project.create()` resets the production project to a blank or sample default, then applies the returned record to live stores.

Invariants: this is destructive and removes all image assets belonging to the active project. The confirmation remains a UI concern.

Editor status: implemented by `Editor.project.create`, composed with `@maply/storage.project.reset`.

## Project File And SVG Workflows

### Export project file

Entry: project menu Export > Project.

Current flow: the live project is assembled with all assets referenced by image elements. The UI serializes it and downloads a sanitized project-name JSON file.

Invariants: export fails if any referenced asset is missing. File shape, compatibility normalization, and serialization are external-format behavior.

Editor status: `Editor.project.export` gathers the active-session snapshot and delegates packaging to `@maply/io.project.file`. Download creation remains in `src`.

### Import project file

Entry: project menu Import > Project, file picker, then replacement confirmation.

Current flow: the UI reads file text and parses it before showing confirmation. Confirming replaces the active project and its assets, refreshes live stores, then reloads the page.

Invariants: cancel discards staged input. Imported project and asset records are reassigned to the active project ID. Missing referenced assets and duplicate asset IDs are rejected before replacement.

Editor status: `@maply/io.project.file.parse` handles untrusted input before confirmation; `Editor.project.import` atomically applies a valid payload through `@maply/storage.project.replace` and reloads live editor state. Dialog/reload policy remains in `src`.

### Export SVG

Entry: project menu Export > SVG.

Current flow: the current project and assets are converted into a standalone SVG with canvas background, elements, embedded images, and Maply recovery metadata.

Invariants: export rejects missing referenced assets. SVG construction, recovery metadata, and font/rendering rules belong to IO.

Editor status: `Editor.project.exportSvg` gathers current data and delegates conversion to `@maply/io.svg.export`; `src` downloads the result.

### Import SVG

Entry: project menu Import > SVG, file picker, then replacement confirmation.

Current flow: the UI delegates SVG parsing to `@maply/io` before confirmation. Import restores Maply recovery metadata first, supports the Synoptic format, and falls back to generic SVG conversion. The replacement dialog displays the selected parser source and generic-import warnings.

Invariants: imported content replaces the active project only after confirmation. Fallback imports can fit an undeclared canvas, drop elements outside a declared canvas, and deduplicate element IDs.

Editor status: `@maply/io.svg.import` parses and diagnoses staged input; `Editor.project.import` atomically applies the confirmed project payload. Parser source and warnings are surfaced by the project-menu UI.

## Canvas, Camera, And Tool Workflows

### Edit canvas frame and appearance

Entry: canvas property inputs and eight canvas resize handles.

Current flow: width, height, origin, and background color update the canvas store. Handle resizing can move the origin when dragging north or west edges.

Invariants: dimensions are finite positive rounded values. Every canvas resize clamps all elements into the resulting canvas.

Editor status: canvas commands are implemented; pointer-handle arithmetic remains in `src`.

### Pan and zoom camera

Entry: wheel, Ctrl/Cmd+wheel, middle-mouse drag, Hand tool drag, and temporary Space-to-hand interaction in `src/components/core/canvas-area/area.state.svelte.ts`.

Current flow: UI converts pointer input to camera changes; the canvas store applies zoom limits and stores camera state with the project.

Invariants: camera changes are autosaved and included in project import/export. Holding Space restores the prior non-Hand tool when released.

Editor status: canvas/tool commands are implemented; event orchestration remains in `src`.

### Select and switch tools

Entry: toolbar and keyboard shortcuts: V, H, R, C, P, T, and I.

Current flow: the tool store holds the active tool, previous tool, and Space-key state.

Invariants: Space must not lose the user-selected tool. Keyboard shortcuts do not run while a text input is being edited.

Editor status: tool state and commands are implemented; shortcut routing remains in `src`.

## Element Creation Workflows

### Draw rectangle, circle, text frame, or image frame

Entry: drag on the artboard with the corresponding drawing tool.

Current flow: `core/canvas-area/drawing-session.svelte.ts` owns pointer draft state and preview derivation. The canvas-area lifecycle shell routes browser events to it; Editor factories create and add the final shape.

Invariants: points are constrained to the canvas. Shapes below the minimum size are discarded. Shift creates a square rectangle. Circle diameter uses the shorter drag-box axis. New elements have generated IDs, unique default names, default style values, and return the tool to Select.

Editor status: creation factories and add/select command are implemented; draft interactions remain in `src`.

### Draw a path

Entry: click artboard vertices with Path selected.

Current flow: the UI manages pending vertices, Shift segment snapping, close affordance, Enter commit, and cancellation. The factory creates the final path element.

Invariants: closed paths require at least three points; a path with fewer than two points is invalid. Current UI only commits closed paths, which use the current default fill, no stroke, and `closed: true`.

Editor status: path geometry and factory are implemented; draft lifecycle remains in `src`.

## Selection And Mutation Workflows

### Select, deselect, hover, and select all

Entry: canvas clicks, sidebar rows, blank canvas/sidebar interactions, Escape, Ctrl/Cmd-click, and Ctrl/Cmd+A.

Current flow: project state tracks ordered selected IDs, the latest selected ID, hover ID, and crop-editing image ID.

Invariants: additive selection toggles membership. Selection changes clear hover. Crop mode is exited unless its image remains selected. Multi-selection is supported for selection, movement, copy, delete, and reordering context but not property editing.

Editor status: project state and selection commands are implemented; hit testing and event handling remain in `src`.

### Move and position elements

Entry: canvas dragging, outline dragging, and arrow keys.

Current flow: a drag moves every current selection when its target is selected; otherwise it selects and moves the target. Arrow keys move a sole selection by 1, or 10 with Shift.

Invariants: all movement is constrained to the canvas. Group movement is clamped as a group, preserving relative positions whenever possible.

Editor status: mutation commands and geometry helpers are implemented.

### Resize elements

Entry: eight outline handles for a singly selected rect, circle, text, or image.

Current flow: UI owns pointer deltas. Editor geometry resizes and clamps the element; Shift at resize start locks aspect ratio.

Invariants: minimum sizes and canvas bounds apply. Circle radius remains bounded by every canvas edge. Text baseline is recalculated when its frame changes. Image crop mode uses a different frame-resize workflow.

Editor status: resize commands and geometry helpers are implemented.

### Edit element properties

Entry: `src/components/properties/ElementProperties.svelte`, its type-specific property modules, and the right properties sidebar.

Current flow: inputs validate numbers and colors, then patch individual elements. Rect, image, and text coordinates are relative to the canvas; circle coordinates are relative center coordinates.

Invariants: every patch is clamped to the canvas. Editing fill also changes the default fill for future rect, circle, and closed-path creation. Text metric changes preserve visual bounds rather than raw baseline coordinates.

Editor status: update command, validation, geometry, and text helpers are implemented; form state remains in `src`.

### Edit names

Entry: sidebar inline rename, properties input, and naming autofix control.

Current flow: names may be committed even when invalid. Validation reports empty, whitespace, leading number or hyphen, unsupported characters, and duplicate selector names. Autofix produces a selector-safe unique name.

Invariants: sidebar Escape cancels; Enter and blur commit. Name validation itself does not mutate until an explicit commit or autofix.

Editor status: naming validation and rename command are implemented.

### Edit path data and vertices

Entry: path properties textarea and single-selection path vertex handles.

Current flow: editing SVG path data infers open or closed state and updates fill/stroke rules. Dragging a vertex rewrites the path while preserving stored offsets and clamping to canvas/stroke padding.

Invariants: closed paths use fill and zero stroke width. Open paths use no fill and a visible stroke.

Editor status: path parsing, normalization, and update commands are implemented; textarea and vertex dragging remain in `src`.

## Image Workflows

### Upload or replace image content

Entry: selected image toolbar Replace image.

Current flow: PNG, JPEG, and SVG files are read to data URLs and image dimensions are loaded. SVG uploads are normalized and reject scripts, inline event handlers, and external references. A new asset is persisted, attached to the element, and the prior asset is removed.

Invariants: persist the replacement before mutating the image element. Reset crop values on replacement. Do not remove the old asset when it is already the replacement asset.

Editor status: browser image workflow is implemented with `@maply/io` validation and atomic `@maply/storage.project.replace` persistence.

### Edit image crop and frame

Entry: selected image toolbar Edit crop, crop overlay drag, resize handles, zoom slider, Reset, and Done.

Current flow: crop mode tracks the selected image. Image pan changes crop offsets; frame resizing recalculates crop to retain the displayed content; the slider sets crop scale.

Invariants: crop offsets remain within -100 to 100 and scale within 100 to 800. Crop mode is valid only while the same image remains selected. Crop-frame resizing remains inside the canvas and preserves visible content when possible.

Editor status: crop state, commands, and geometry are implemented; overlay interaction remains in `src`.

### Download source image

Entry: selected image toolbar Download.

Current flow: the UI downloads the stored asset data URL with its stored name or a derived fallback name.

Invariants: unavailable for empty image frames. This is a UI download concern, not an editor persistence workflow.

Editor status: unchanged target. `src` retains download behavior; editor exposes read-only image-asset state.

## Clipboard And Deletion Workflows

### Copy and paste elements

Entry: Ctrl/Cmd+C, Ctrl/Cmd+V, and canvas/element context menus.

Current flow: copy saves immutable element snapshots in an application-memory clipboard. Paste clones elements, IDs, and names. Image elements clone their asset record to a new ID before attachment.

Invariants: clipboard contents are neither persisted nor connected to the operating-system clipboard. Keyboard paste uses the standard duplicate offset. Context-menu paste positions the pasted group so its upper-left bounds begin at the clicked canvas point. Missing copied image assets yield an unlinked pasted image.

Editor status: clipboard state, duplicate helpers, and asset cloning workflow are implemented; shortcut and context-menu handling remain in `src`.

### Delete elements

Entry: Delete/Backspace outside text inputs, sidebar trash, and context menus.

Current flow: selected deletion removes all selected elements if the target is selected; otherwise it removes only the target. The store removes matching image assets from its cache and asynchronously deletes them from persistence.

Invariants: selection is repaired after deletion. Crop mode exits when its image is deleted. UI removal is immediate even if asset persistence cleanup fails; cleanup failure is logged.

Editor status: delete command is implemented with `@maply/storage.imageAsset.delete` cleanup.

## Layering Workflows

### Reorder and move layer position

Entry: element-list press-and-hold drag, canvas and sidebar context menus.

Current flow: the sidebar displays reverse paint order, so its drag indices are translated before the project element array is reordered. Context actions move an element to front, forward, backward, or back.

Invariants: sidebar drag begins after 220ms and supports edge autoscroll. Context actions are disabled at the appropriate ordering boundary. Layer order is the element-array paint order.

Editor status: ordering commands are implemented; drag state and menu presentation remain in `src`.

## Non-Editor Workflows

### Theme preference

Current flow: the top bar persists light, dark, or system preference in localStorage, updates the document class, and follows system preference in system mode.

Target: remains in `src` because it owns document and browser preference effects.

## Legacy And Unused Surfaces

Several former convenience commands, clipboard clear, and import/export panel UI state had no production caller. Do not add them to the public editor API without a current workflow requiring them.

Project-file, SVG, IndexedDB, store, and command ownership now resides in `@maply/io`, `@maply/storage`, and `editor/`; the duplicate legacy implementations were deleted.
