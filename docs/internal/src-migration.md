# Src Migration

This document defines the remaining compatibility migration that moves active SvelteKit UI callers from legacy `@app` to the root `editor` module and the `@maply/*` packages.

This is not a redesign. Preserve current UI behavior, component structure, pointer interactions, dialogs, file pickers, downloads, theme behavior, and shadcn usage. The goal is to hollow out `app/` by switching callers to the new seams, then deleting legacy code only after searches and checks prove it unused.

## Current State

The package/editor extraction is far enough for the `src` compatibility chunk:

- `@maply/model` owns pure schemas, inferred types, default projects, validation parsers, geometry primitives, and tool helpers.
- `@maply/io` owns `.maply` project file parsing/serialization, SVG import/export, and image/SVG input preparation.
- `@maply/storage` owns IndexedDB persistence for projects and image assets.
- `editor/` owns live editor state and commands through the `editor` alias.
- `src/` still imports `@app` in active UI files, so legacy `app/` modules remain production dependencies.
- `tests/app/internal/*` still cover legacy implementations that now overlap with package/editor tests.

Active `src` files importing `@app`:

- `src/routes/+layout.svelte`
- `src/components/EditorScreen.svelte`
- `src/components/CanvasArea.svelte`
- `src/components/ElementProperties.svelte`
- `src/components/RightSidebar.svelte`
- `src/components/left-sidebar/ProjectSection.svelte`
- `src/components/left-sidebar/ElementsSection.svelte`
- `src/components/canvas/Artboard.svelte`
- `src/components/canvas/CanvasResizeHandles.svelte`
- `src/components/canvas/ContextMenuContent.svelte`
- `src/components/canvas/ElementOutline.svelte`
- `src/components/canvas/ElementShapes.svelte`
- `src/components/canvas/ImageCropOverlay.svelte`
- `src/components/canvas/ImageCropToolbar.svelte`
- `src/components/canvas/PathElementHandles.svelte`
- `src/components/canvas/PathElementOutline.svelte`
- `src/components/core/ColorPicker.svelte`
- `src/components/core/ElementNameValidation.svelte`
- `src/components/core/ProjectMenuOverlay.svelte`
- `src/components/core/Toolbar.svelte`
- `src/components/core/Topbar.svelte`
- `src/components/core/area.state.svelte.ts`
- `src/components/core/cursors.ts`
- `src/components/core.ts`

## Target Ownership

`src/` remains the SvelteKit web shell for this phase. Do not move it to `packages/web` yet.

Keep in `src/`:

- Svelte components, routes, layouts, global CSS, and shadcn composition.
- Browser event listeners, pointer gesture state, DOM/SVG measurement, hit testing, and context-menu presentation.
- Dialog state, file picker inputs, download creation, `window.location.reload()`, and logging policy.
- Theme preference because it mutates `document`, uses `localStorage`, and tracks system preference.
- Canvas cursor assets and UI-only derived display state.

Move callers to `editor` for:

- Session load, autosave queue/flush, project rename/create/import/export, SVG import/export.
- Live project, canvas, fill, tool, and image-asset stores.
- Canvas frame/color/camera commands.
- Tool selection and Space-to-hand state.
- Element add/delete/reorder/move/resize/update/rename/path-vertex commands.
- Selection, hover, crop mode, clipboard, image replacement, image crop, and element factories.
- Editor-owned validation and geometry helpers that are part of live editing semantics.

Move callers to `@maply/model` for:

- Public model types such as `Element`, `ImageElement`, `PathElement`, `Point`, `Tool`, `Canvas`, `Camera`, and `StoredImageAsset`.
- Pure validation parsers already exported from `@maply/model`: `parseIntNumber`, `parsePositiveInt`, `parseNonNegativeNumber`, and `parseHexColor`.
- Pure model helpers already exported from `@maply/model`, such as `isPointInsideCanvas`, `drawingTools`, and `isDrawingTool`.

Move callers to `@maply/io` for:

- Parsing uploaded `.maply` project files before confirmation.
- Serializing exported project payloads for download.
- Parsing SVG text before confirmation, if the UI keeps pre-confirm validation.
- Preparing/validating uploaded image files only through editor image workflows unless a UI-only preview requires it.

Do not import `app/` from `editor/`, packages, or migrated `src` files. Do not deep-import private files under `editor/*` or package feature folders from `src` unless that subpath is explicitly exported and documented.

## Public API Gaps To Close First

Most old `App` calls have direct `Editor` equivalents, but several UI callers currently depend on helpers hidden inside legacy `app/` or private editor files. Close these with the smallest public surface before mass import replacement.

Add or expose through `editor/index.ts`:

- `Editor.geometry.shapeDragBox`, backed by `getShapeDragBox`, for drawing previews in `area.state.svelte.ts`.
- `Editor.geometry.elementBounds`, backed by `getElementBounds`, for selection outlines, text property display, resize aspect ratio, and hit-derived layout.
- `Editor.geometry.pathPoints`, `Editor.geometry.pathBounds`, `Editor.geometry.pathRenderTransform`, and `Editor.geometry.snapPathSegment` if current path UI still needs the legacy behavior. Verify whether existing editor path helpers are sufficient before adding names.
- `Editor.geometry.imageRenderRect` if `ElementShapes.svelte` or image download/crop rendering still depends on the legacy helper.
- `Editor.text.wrappedLines`, `Editor.text.wrappedLineHeight`, `Editor.text.wrappedMetrics`, and `Editor.text.layoutMetrics` if `ElementShapes.svelte` and `ElementProperties.svelte` still need legacy text wrapping behavior. Do not replace browser-compatible text layout with the current minimal `getTextBounds` unless parity is verified.
- `Editor.fill.get` or an equivalent read API if path property editing still needs the current default fill for open-to-closed path conversion. `Editor.state.fill` may be enough if the caller can use a store read.
- Public type export for `ElementNameValidation` from the module that owns name validation, or move the type to `@maply/model/types` if it is pure model contract.
- Public type export for `ProjectFilePackage` from `@maply/io` or a documented `@maply/io/types` subpath if `src` stages parsed import payloads before confirmation.

Consider keeping theme outside `editor`:

- Either leave `app/store/theme.svelte.ts` temporarily as a non-editor legacy island and record it explicitly, or move it to a small `src` module such as `src/lib/theme.svelte.ts`.
- Prefer moving theme into `src` during this chunk because it is UI/browser-owned and should not block `app/` deletion.

Do not add pass-through APIs just to preserve the exact old `App` shape. Add grouped APIs only when they hide implementation knowledge from `src` and are expected to remain the UI seam.

## Import Replacement Map

Use this mapping during the compatibility chunk:

| Legacy caller | Target caller |
| --- | --- |
| `App.load()` | `Editor.load()` |
| `App.state.project` | `Editor.state.project` |
| `App.state.canvas` | `Editor.state.canvas` |
| `App.state.fill` | `Editor.state.fill` |
| `App.state.tool` | `Editor.state.tool` |
| `App.state.imageAssets` | `Editor.state.imageAssets` |
| `App.save.queue()` | `Editor.save.queue()` |
| `App.save.flush()` | `Editor.save.flush()` |
| `App.project.create(...)` | `Editor.project.create(...)` |
| `App.project.import(...)` | `Editor.project.import(...)` |
| `App.project.export()` | `Editor.project.export()` |
| `App.project.svg()` | `Editor.project.exportSvg()` |
| `App.actions.project.setName(...)` | `Editor.project.rename(...)` |
| `App.actions.project.selectElement(...)` | `Editor.selection.select(...)` |
| `App.actions.project.selectAll()` | `Editor.selection.selectAll()` |
| `App.actions.project.setHoveredElement(...)` | `Editor.selection.setHover(...)` |
| `App.actions.project.setCropEditingElement(...)` | `Editor.selection.toggleCrop(...)` or a small explicit setter if needed |
| `App.actions.project.addElement(...)` | `Editor.element.add(...)` |
| `App.actions.project.updateElement(...)` | `Editor.element.update(...)` |
| `App.actions.project.renameElement(...)` | `Editor.element.rename(...)` |
| `App.actions.project.translateElement(...)` | `Editor.element.translate(...)` |
| `App.actions.project.translateElements(...)` | `Editor.element.translateAll(...)` |
| `App.actions.project.setElementPosition(...)` | `Editor.element.setPosition(...)` |
| `App.actions.project.resizeElement(...)` | `Editor.element.resize(...)` |
| `App.actions.project.clampElementsToCanvas()` | `Editor.element.clampAll()` |
| `App.actions.project.reorderElements(...)` | `Editor.element.reorder(...)` |
| `App.actions.project.moveElementToFront(...)` | `Editor.element.moveToFront(...)` |
| `App.actions.project.moveElementForward(...)` | `Editor.element.moveForward(...)` |
| `App.actions.project.moveElementBackward(...)` | `Editor.element.moveBackward(...)` |
| `App.actions.project.moveElementToBack(...)` | `Editor.element.moveToBack(...)` |
| `App.actions.project.translateImageCrop(...)` | `Editor.image.translateCrop(...)` |
| `App.actions.project.resizeImageFrame(...)` | `Editor.image.resizeFrame(...)` |
| `App.actions.project.resetImageCrop(...)` | `Editor.image.resetCrop(...)` |
| `App.actions.project.setImageCropScale(...)` | `Editor.image.setCropScale(...)` |
| `App.element.replaceImage(...)` | `Editor.image.replace(...)` or `Editor.image.fromFile(...)` depending on current caller need |
| `App.element.delete(...)` | `Editor.element.delete(...)` |
| `App.element.paste(...)` | `Editor.clipboard.paste(...)` |
| `App.actions.clipboard.copy(...)` | `Editor.clipboard.copy(...)` |
| `App.actions.clipboard.get()` | `Editor.clipboard.get()` |
| `App.actions.canvas.setSize(...)` | `Editor.actions.canvas.setSize(...)` |
| `App.actions.canvas.setFrame(...)` | `Editor.actions.canvas.setFrame(...)` |
| `App.actions.canvas.setColor(...)` | `Editor.actions.canvas.setColor(...)` |
| `App.actions.canvas.setPosition(...)` | `Editor.actions.canvas.setPosition(...)` |
| `App.actions.canvas.setCamera(...)` | `Editor.actions.canvas.setCamera(...)` |
| `App.actions.canvas.pan(...)` | `Editor.actions.canvas.pan(...)` |
| `App.actions.canvas.zoomIn()` | `Editor.actions.canvas.zoomIn()` |
| `App.actions.canvas.zoomOut()` | `Editor.actions.canvas.zoomOut()` |
| `App.actions.canvas.resetZoom()` | `Editor.actions.canvas.resetZoom()` |
| `App.actions.canvas.resetCamera()` | `Editor.actions.canvas.resetCamera()` |
| `App.actions.canvas.centerCamera(...)` | `Editor.actions.canvas.centerCamera(...)` |
| `App.actions.tool.set(...)` | `Editor.actions.tool.set(...)` |
| `App.actions.tool.setSpacePressed(...)` | `Editor.actions.tool.setSpacePressed(...)` |
| `App.actions.fill.set(...)` | `Editor.state.fill` write API or a small `Editor.fill.set(...)` export |
| `App.validate.elementNames(...)` | `Editor.naming.validate(...)` |
| `App.validate.*` numeric/color parsers | `@maply/model` parser exports |
| `App.create.*` | `Editor.create.*` |
| `App.geometry.isPointInsideCanvas(...)` | `@maply/model.isPointInsideCanvas(...)` |
| `App.geometry.*` editor-specific helpers | `Editor.geometry.*` after public API gap is closed |
| `App.text.*` | `Editor.text.*` after public API gap is closed |
| `App.codec.project.parse(...)` | `@maply/io.project.file.parse(...)` |
| `App.codec.project.stringify(...)` | `@maply/io.project.file.serialize(...)` |
| `App.codec.svg.parse(...)` | `@maply/io.svg.import(...)` |
| `App.theme.*` | `src`-owned theme module |
| `@app/types` model types | `@maply/model/types` |
| `@app/types` editor-only types | `editor` exports or local UI types |
| `@app/internal/canvas.sanitizeCanvasSize` | `@maply/model` export if pure, otherwise `editor` canvas helper |

## Suggested Chunk Order

1. Add missing public editor/package exports.

   Keep this first commit narrow. Do not edit Svelte callers yet except for type checks if needed. Public exports should come from `editor/index.ts`, `@maply/model`, or `@maply/io` documented entrypoints. Avoid exposing private implementation folders as deep imports.

2. Move theme ownership out of `app`.

   Create a `src`-owned theme module that preserves the current `light | dark | system` behavior, localStorage key, document class updates, and system preference listener. Update `Topbar.svelte` and `+layout.svelte` to use it. This avoids keeping all of `app` alive for one browser-only store.

3. Migrate layout and top-level stores.

   Update `+layout.svelte`, `EditorScreen.svelte`, `CanvasArea.svelte`, and top-level sidebar components to import `Editor` and model types. Preserve autosave ownership in layout: observe project and canvas stores, skip saves before initialization, queue saves after initialized changes, and flush on `pagehide`, `beforeunload`, and hidden-document visibility.

4. Migrate project menu workflows.

   Update `ProjectMenuOverlay.svelte` from `App.project` and `App.codec` to `Editor.project` and `@maply/io`. Keep file reading, confirmation dialogs, download creation, sanitized filenames, busy state, logging, and reload policy in `src`. Decide how generic SVG import warnings should be surfaced; if no UI is added in this chunk, preserve current silent/logging behavior and record the diagnostics follow-up.

5. Migrate canvas and pointer interactions.

   Update `area.state.svelte.ts`, `Artboard.svelte`, `CanvasResizeHandles.svelte`, `ElementOutline.svelte`, `PathElementHandles.svelte`, `ImageCropOverlay.svelte`, and context-menu components. Keep gesture/session state local. Route committed commands through `Editor`.

   The image crop frame resize migration must fix the known caller-pattern bug: store the original pre-drag crop state and frame at `pointerdown`, then pass those originals for every move while only the next frame changes. Do not call crop frame resize with an incrementally rounded previous frame on every `pointermove`.

6. Migrate element rendering and property editing.

   Update `ElementShapes.svelte`, `PathElementOutline.svelte`, `ElementProperties.svelte`, `RightSidebar.svelte`, `ElementsSection.svelte`, `ElementNameValidation.svelte`, `ColorPicker.svelte`, `Toolbar.svelte`, `core.ts`, and `cursors.ts`. Prefer `@maply/model/types` for model types and `Editor.naming.validate` for name validation. Keep form parsing and UI draft state inside components.

7. Run searches and delete dead legacy `app` modules.

   After `src` no longer imports `@app`, search the repo for `@app`, `app/`, and direct legacy module imports. Delete replaced legacy modules only when no active production or test caller remains. Do not delete a module still covered by a test until its replacement package/editor test exists.

8. Retire or migrate legacy tests.

   Replace `tests/app/internal/project-file.test.ts`, `svg-export.test.ts`, and `svg-import.test.ts` with existing or expanded `packages/io` tests. Replace `tests/app/internal/image-assets.test.ts` and `path-geometry.test.ts` with editor/package tests if the behavior still belongs to editor. Keep parity tests for tricky geometry, text metrics, path bounds, and crop resize interactions.

9. Remove the `@app` alias only after no callers remain.

   Once searches are clean and checks pass, remove `@app` from `svelte.config.ts`, remove `app/**/*.ts` from `tsconfig.json` if the folder is deleted, and update dependency-cruiser checks if legacy rules become obsolete.

## Migration Chunks And Progress

Use this section as the working tracker. Update `Status` and `Notes` as chunks land. Keep status values to `pending`, `in-progress`, `blocked`, `done`, or `skipped`.

### Chunk 0: Public API Gap Audit

Status: done

Scope:

- Compare every active `App.*` call in `src` against existing `Editor` and package exports.
- Decide which missing helpers belong in `editor`, `@maply/model`, `@maply/io`, or `src`.
- Avoid deep imports from private editor/package files.

Exit criteria:

- All required replacement APIs are listed with target owners.
- Any intentionally deferred API gap is recorded in `migration-findings.md` or in this chunk's notes.

Notes:

- Completed 2026-07-13. Full audit results in `docs/internal/src-findings.md`.
- Confirmed gaps: `Editor.fill.set`, `Editor.geometry.*` (6 helpers — 4 exist internally, 2 need porting from app), `Editor.text.*` (4 helpers need porting), `ProjectFilePackage` type export from `@maply/io`, theme move to `src`.
- No gap: all `App.state/actions/element/create/project/save/clipboard/naming` have direct Editor equivalents. Validators and `isPointInsideCanvas` already in `@maply/model`. Codecs covered by `@maply/io`.
- Potential issues recorded: crop resize rounding drift, text metrics parity, `sanitizeCanvasSize` placement.

### Chunk 1: Public Editor And Package Exports

Status: done

Scope:

- Add the smallest public exports needed by `src` migration.
- Prefer `editor/index.ts`, `@maply/model`, `@maply/io`, or documented `types` subpaths.
- Add focused tests only where an export introduces or changes behavior.

Exit criteria:

- `pnpm check` passes.
- Package tests pass for touched packages.
- `src` can import replacements without deep-importing private implementation files.

Notes:

- Do not reshape the full editor API into the old `App` shape.
- Completed 2026-07-13.
- Added public `Editor.fill.set`, `Editor.geometry.*`, and `Editor.text.*` seams needed by `src` migration without exposing private editor folders.
- Exported `ElementNameValidation` from `editor` and use existing `ProjectFilePackage` from `@maply/io/types`.
- Isolated legacy-parity text metrics, path bounds/render transform, path snapping, and image render rect behavior under `editor/compat/*` bridges so final ownership can be patched back into packages/modules later.
- Verified with `pnpm test:model`, `pnpm test:io`, focused editor tests, and `pnpm check`.

### Chunk 2: Theme Ownership Move

Status: pending

Scope:

- Move light/dark/system theme preference from legacy `app` into a `src`-owned module.
- Update `src/routes/+layout.svelte` and `src/components/core/Topbar.svelte`.
- Preserve localStorage key, document class behavior, and system preference listener behavior.

Exit criteria:

- No `App.theme` callers remain.
- Theme behavior is still browser/UI-owned and not part of `editor`.
- `pnpm check` passes.

Notes:

- Keep the module small and local to `src`; do not create a package for theme.

### Chunk 3: Layout And Top-Level State Migration

Status: pending

Scope:

- Migrate `+layout.svelte`, `EditorScreen.svelte`, `CanvasArea.svelte`, `LeftSidebar.svelte`, `RightSidebar.svelte`, and top-level shared imports where practical.
- Replace `App.state.*`, `App.load`, `App.save.*`, keyboard shortcuts, selection clearing, delete, clipboard, and arrow-key movement with `Editor` APIs.
- Keep browser lifecycle event listeners and autosave observation in layout.

Exit criteria:

- Top-level app shell no longer imports `@app`.
- Autosave still queues only after initialization and flushes on page lifecycle events.
- `pnpm check` passes.

Notes:

- If component-specific dependencies make this too large, split sidebar files into Chunk 6.

### Chunk 4: Project Menu And File Workflows

Status: pending

Scope:

- Migrate `ProjectMenuOverlay.svelte` and legacy `ProjectSection.svelte` if it still has callers.
- Replace project create/import/export/SVG workflows with `Editor.project` and `@maply/io` APIs.
- Keep file picker, confirmation dialog, busy state, download creation, sanitized filename, logging, and reload policy in `src`.

Exit criteria:

- Project menu no longer imports `@app`.
- Project import/export and SVG import/export behavior is preserved.
- Generic SVG import diagnostics have a documented UI/logging decision.
- `pnpm check` passes.

Notes:

- If `@maply/io` does not export the staged import payload type needed by the dialog, add that in Chunk 1 first.

### Chunk 5: Canvas Interaction Migration

Status: pending

Scope:

- Migrate `area.state.svelte.ts`, `Artboard.svelte`, `CanvasResizeHandles.svelte`, `ElementOutline.svelte`, `PathElementHandles.svelte`, `ImageCropOverlay.svelte`, and canvas context-menu components.
- Keep pointer draft state, DOM/SVG measurement, event listeners, and context-menu presentation in `src`.
- Route committed commands through `Editor`.

Exit criteria:

- Canvas interaction files no longer import `@app`.
- Drawing, selection, panning, zooming, context menus, canvas resize, element move/resize, path handles, and crop overlay behavior are preserved.
- Image crop frame resize uses original pre-drag crop/frame state and avoids incremental rounding drift.
- `pnpm check` passes.

Notes:

- This is the riskiest UI behavior chunk. Prefer focused tests for crop resize and path geometry if behavior changes are needed.

### Chunk 6: Element Rendering, Properties, And Sidebars

Status: pending

Scope:

- Migrate `ElementShapes.svelte`, `PathElementOutline.svelte`, `ElementProperties.svelte`, `ElementsSection.svelte`, `RightSidebar.svelte`, `ElementNameValidation.svelte`, `ColorPicker.svelte`, `Toolbar.svelte`, `core.ts`, and `cursors.ts`.
- Replace model types with `@maply/model/types`.
- Replace numeric/color validation with `@maply/model` exports.
- Replace name validation/autofix, element updates, layer commands, fill commands, image toolbar commands, and toolbar tool selection with `Editor`.

Exit criteria:

- Rendering/property/sidebar files no longer import `@app`.
- Text metrics and visual text coordinate behavior are verified against legacy behavior.
- Sidebar reorder still preserves reverse display order versus paint order.
- `pnpm check` passes.

Notes:

- Do not edit generated shadcn files under `src/lib/components/ui/*`.

### Chunk 7: Test Migration And Legacy Test Retirement

Status: pending

Scope:

- Replace or retire `tests/app/internal/*` tests after equivalent package/editor coverage exists.
- Move project-file and SVG assertions to `packages/io` tests when missing.
- Move image crop/path/geometry behavior assertions to editor tests when still relevant.

Exit criteria:

- No test imports from `@app` remain unless a deliberate temporary legacy test is documented.
- `pnpm test`, `pnpm test:model`, `pnpm test:io`, and `pnpm test:storage` pass as relevant.

Notes:

- Do not delete behavior coverage just because the legacy module is being deleted.

### Chunk 8: Legacy App Deletion

Status: pending

Scope:

- Search for remaining `@app` and `app/` imports.
- Delete legacy `app` modules that have no production or test callers.
- Remove `@app` alias and `app/**/*.ts` TypeScript include only after the folder is gone or no longer needed.
- Update dependency-cruiser rules if they become obsolete.

Exit criteria:

- Production and test imports from `@app` are gone.
- Deleted modules have replacement coverage or are proven unused.
- `pnpm check`, `pnpm test`, and `pnpm build` pass.

Notes:

- Do not delete unrelated legacy code if a current caller still exists. Record blockers in this chunk.

### Chunk 9: Follow-Up Findings Closure

Status: pending

Scope:

- Resolve or explicitly defer findings from `migration-findings.md` that are exposed by the `src` migration.
- Prioritize hydrated normalization parity, IndexedDB v3 upgrade coverage, generic SVG import diagnostics, `importExportState` removal, and crop resize drift.

Exit criteria:

- Each affected finding is marked `done`, still `planned/open` with a clear reason, or moved into a separate tracked task.
- The migration docs and findings agree on final status.

Notes:

- This chunk can happen in parallel with cleanup only when it does not keep legacy `app` modules alive.

## File-Specific Notes

`src/routes/+layout.svelte`:

- Replace `App.state.canvas/project`, `App.load`, and `App.save.*` with `Editor`.
- Move `App.theme.use()` to a `src` theme module.
- Keep cursor CSS variable setup and browser lifecycle event listeners in the layout.

`src/components/core/ProjectMenuOverlay.svelte`:

- Replace project create/import/export/SVG export with `Editor.project.*`.
- Replace project-file parse/serialize and SVG parse with `@maply/io` APIs or editor project import APIs if confirmation can stage the parsed result.
- Keep the hidden inputs, dialogs, busy flags, downloads, and reload after import in `src`.

`src/components/core/area.state.svelte.ts`:

- Replace store reads and commands with `Editor`.
- Replace `App.geometry.isPointInsideCanvas` with `@maply/model.isPointInsideCanvas`.
- Replace shape creation with `Editor.create.*` and add through `Editor.element.add`.
- Keep `DrawingSession`, `PathSession`, SVG point conversion, pointer listeners, context menu state, and path draft lifecycle in `src`.

`src/components/canvas/CanvasResizeHandles.svelte`:

- Replace `sanitizeCanvasSize` deep import from `@app/internal/canvas` with a public pure helper. If the helper is pure model validation, export it from `@maply/model`; otherwise expose a small editor canvas helper.
- Keep handle arithmetic in `src`; commit with `Editor.actions.canvas.setFrame` and `Editor.element.clampAll`.

`src/components/canvas/ElementOutline.svelte`:

- Replace selection, move, and resize commands with `Editor.selection` and `Editor.element`.
- Keep DOM `getBBox()` and matrix projection in `src`, because outline measurement is browser/SVG interaction.
- Use `Editor.geometry.elementBounds` only for model-derived bounds and aspect ratio.

`src/components/canvas/ImageCropOverlay.svelte`:

- Replace crop pan and resize commands with `Editor.image.translateCrop` and `Editor.image.resizeFrame`.
- Fix crop resize caller state as part of this migration. Capture the original element frame and crop values at pointerdown; do not use rounded per-frame state as the next call's previous frame.

`src/components/ElementProperties.svelte`:

- Replace numeric parsers with `@maply/model` validation exports.
- Replace updates with `Editor.element.update`.
- Replace default fill writes/reads with the final public fill API.
- Keep input event parsing and textarea commit policy in the component.
- Verify text visual coordinate parity before replacing legacy text metrics with editor text helpers.

`src/components/left-sidebar/ElementsSection.svelte` and `RightSidebar.svelte`:

- Replace name validation with `Editor.naming.validate` and autofix with `Editor.naming.autofix`.
- Replace rename, selection, reorder, delete, clipboard, and layer commands with `Editor` groups.
- Preserve sidebar display order conversion for drag reorder.

`src/components/canvas/ImageCropToolbar.svelte`:

- Replace crop mode, reset, slider, replacement, and image-asset reads with `Editor` state/commands.
- Keep file picker and source-image download mechanics in `src`.

`src/components/core/Topbar.svelte`:

- Replace `App.theme` with the new `src` theme module.
- Do not move theme into `editor`; it is a browser/UI preference, not editing state.

## Behavior Parity Checks

Verify these manually or through focused tests before deleting `app/`:

- A persisted project loads once, clears selection/hover/crop state, restores canvas/camera, and hydrates image assets.
- Autosave does not run before initialization, queues after project/canvas edits, and flushes on page lifecycle events.
- Project rename, new blank project, and new sample project preserve current confirmation and destructive behavior.
- Project export downloads the same JSON-compatible payload and rejects missing referenced assets.
- Project import stages parsed content before confirmation, replaces active project/assets, then reloads according to current UI policy.
- SVG export produces current recovery metadata and embedded image behavior.
- SVG import preserves recovery and Synoptic behavior; generic import warnings have an explicit UI/logging decision.
- Canvas resize clamps elements and preserves origin movement for north/west handles.
- Pan, zoom, Space-to-hand, and keyboard tool shortcuts behave the same and do not fire inside text inputs.
- Shape drawing discards too-small drags, clamps to canvas, applies Shift square behavior for rectangles, and returns to Select.
- Path drawing preserves Shift snapping, close affordance, Enter commit, Escape cancel, and closed-path defaults.
- Selection supports additive toggle, deselect, hover clearing, select all, and crop-mode repair.
- Move and resize preserve group clamping, aspect lock, minimum sizes, circle constraints, and text baseline behavior.
- Element property edits clamp to canvas and update default fill where current behavior does.
- Name validation and autofix preserve current warning reasons and duplicate detection.
- Image replacement persists asset and project atomically, resets crop, and removes the old asset only when safe.
- Image crop pan, slider, reset, and frame resize preserve crop bounds and avoid incremental rounding drift.
- Clipboard copy/paste preserves multi-selection, offset paste, context-menu paste position, cloned IDs/names, and image asset cloning.
- Delete repairs selection, exits crop mode when needed, and cleans image assets through storage.
- Layer reorder preserves paint order versus sidebar reverse display order.
- Theme light/dark/system preference persists and updates the document class.

## Cleanup Rules

Delete only after clean searches and checks:

- `app/services/indexed-db.ts`, `app/services/project-repo.ts`, `app/runtime/browser-runtime.ts`, and `app/internal/db.ts` after no storage callers remain.
- `app/internal/project-file.ts`, `app/internal/svg-import.ts`, and `app/internal/svg-export.ts` after no codec callers or legacy tests remain.
- `app/store/project.ts`, `app/store/canvas.ts`, `app/store/tool.ts`, `app/store/fill.ts`, `app/store/image-assets.ts`, and `app/store/clipboard.svelte.ts` after all live state callers use `editor`.
- `app/internal/actions.ts`, `app/internal/create.ts`, `app/internal/element.ts`, `app/internal/geometry.ts`, `app/internal/text.ts`, `app/internal/validate.ts`, and `app/internal/element-actions/*` after all UI helper and command callers have replacements.
- `app/domain/*` after model/package/editor replacements cover all remaining imports.
- `app/types.ts`, `app/effect.ts`, and `app/index.ts` only after all `@app` imports are gone.

Keep open findings in `docs/internal/migration-findings.md` unless the migration actually resolves them. Update that file when resolving hydrated normalization parity, IndexedDB upgrade coverage, generic SVG diagnostics, `importExportState` removal, or crop resize drift.

## Verification

Run these after the compatibility chunk:

```sh
pnpm check
pnpm test
pnpm build
```

Run package-specific tests when touching package surfaces:

```sh
pnpm test:model
pnpm test:io
pnpm test:storage
```

Do not run the dev server.

Search gates before deleting `app/`:

```sh
rg "@app|from ['\"]app/|from ['\"]\.\./app|from ['\"]\.\./\.\./app" src tests packages editor
rg "app/" docs/internal tests packages editor src
```

The second search may still show documentation references. Production and test imports must be gone before removing the alias and folder.
