# Src Migration Findings

Historical note: this file records the pre-migration gap analysis. Current status and remaining work live in `migration-findings.md`; references below to `App`, deleted `app/` paths, and former `src/components` paths describe the implementation at the time of the audit.

Findings, gaps, and issues discovered during the `src/` compatibility migration from `@app` to `editor` and `@maply/*` packages.

## Chunk 0: Public API Gap Audit

### Editor Gaps

#### `Editor.fill.set` — Missing fill write API

`fillState` in `editor/state/document.ts` is a writable Svelte store, but `Editor.state.fill` exposes it as `readonly(fillState)`. `src` callers use `App.actions.fill.set` and `App.actions.fill.get` to write/read the default fill color. Need a public `Editor.fill.set(color)` or expose the writable store.

Owner: `editor/index.ts`

#### `Editor.geometry.*` — Geometry namespace not exposed

The following functions exist in `editor/elements/geometry.ts` and `editor/elements/path.ts` but are not exported through `Editor`:

| Function        | Internal location                                  | Notes                                                       |
| --------------- | -------------------------------------------------- | ----------------------------------------------------------- |
| `shapeDragBox`  | `editor/elements/geometry.ts` → `getShapeDragBox`  | Used by `area.state.svelte.ts` for drawing previews         |
| `elementBounds` | `editor/elements/geometry.ts` → `getElementBounds` | Used by selection outlines, resize aspect ratio, hit layout |
| `pathPoints`    | `editor/elements/path.ts` → `toPathPoints`         | Used by path handles UI                                     |
| `pathBounds`    | Composable from `getPointBounds(toPathPoints(d))`  | Used by path outline rendering                              |

These are already implemented in the editor and just need re-export.

Owner: `editor/index.ts`

#### `Editor.geometry.pathRenderTransform` — Not in editor

Lives in `app/internal/element-actions/geometry.ts`. Computes the translation offset for path rendering. Needs to be moved into `editor/elements/geometry.ts` and exported.

Owner: `editor/elements/geometry.ts` → `editor/index.ts`

#### `Editor.geometry.snapPathSegment` — Not in editor

Lives in `app/internal/path-geometry.ts`. Snaps path segments to directional angles during Shift-constrained drawing. Needs to be moved into `editor/elements/path.ts` or a new `editor/elements/path-geometry.ts` and exported.

Owner: `editor/elements/path.ts` → `editor/index.ts`

#### `Editor.geometry.imageRenderRect` — Not in editor

Lives in `app/internal/image-assets.ts`. Computes the visible image rectangle within a crop frame. Used by `ElementShapes.svelte` for image rendering and by crop/download workflows. Needs to be moved into `editor/image/` and exported.

Owner: `editor/image/` → `editor/index.ts`

#### `Editor.text.*` — Text layout helpers not in editor

Four text helpers live in `app/internal/element-actions/text.ts` and have no editor equivalent. The editor only has `getTextBounds` in `editor/elements/text.ts`.

| Function            | Purpose                                                    |
| ------------------- | ---------------------------------------------------------- |
| `wrappedLines`      | Returns array of wrapped text lines for SVG rendering      |
| `wrappedLineHeight` | Returns the computed line height for a text element        |
| `wrappedMetrics`    | Returns combined wrapped text metrics (lines + dimensions) |
| `layoutMetrics`     | Returns layout metrics from raw text/fontSize/width params |

These are needed by `ElementShapes.svelte` for text rendering and `ElementProperties.svelte` for text property display.

Owner: `editor/elements/text.ts` → `editor/index.ts`

### @maply/io Gaps

#### `ProjectFilePackage` type — Not publicly exported

`ProjectFilePackage` is defined in `packages/io/src/project/common.ts` and used internally by `@maply/io`, but not re-exported from `packages/io/src/index.ts`. `src` needs this type to stage parsed import payloads before confirmation dialogs.

Owner: `packages/io/src/index.ts`

### src-Local

#### Theme module — Move out of `app/`

`App.theme.set` and `App.theme.use` manage light/dark/system preference via `localStorage` and document class mutation. This is browser-only UI state and should not live in `editor`. Move to `src/lib/state/theme.svelte.ts` during Chunk 2.

Owner: `src/lib/state/theme.svelte.ts`

### No Gap (Confirmed Covered)

These `App.*` paths have direct or renamed equivalents already:

- All `App.state.*` → `Editor.state.*`
- All `App.actions.canvas.*` → `Editor.actions.canvas.*`
- All `App.actions.tool.*` → `Editor.actions.tool.*`
- All `App.actions.project.*` (21 methods) → `Editor.element.*`, `Editor.selection.*`, `Editor.image.*`
- `App.actions.clipboard.*` → `Editor.clipboard.*`
- `App.element.delete/paste` → `Editor.element.delete`, `Editor.clipboard.paste`
- `App.create.*` → `Editor.create.*`
- `App.project.*` → `Editor.project.*`
- `App.save.*` → `Editor.save.*`
- `App.validate.elementNames` → `Editor.naming.validate`
- `App.validate.hexColor/int/positiveInt/nonNegativeNumber` → `@maply/model` parser exports (`parseHexColor`, `parseIntNumber`, `parsePositiveInt`, `parseNonNegativeNumber`)
- `App.geometry.isPointInsideCanvas` → `@maply/model.isPointInsideCanvas`
- `App.geometry.updatePathVertex` → `Editor.element.updatePathVertex`
- `App.codec.project.parse/stringify` → `@maply/io.project.file.parse/serialize` (Effect-based equivalents)
- `App.codec.svg.parse` → `@maply/io.svg.import`

### Potential Issues

#### Crop resize incremental rounding drift

`ImageCropOverlay.svelte` passes the current (already-rounded) frame as the "previous frame" on each `pointermove`, causing cumulative rounding errors during drag. The fix: capture original pre-drag crop state at `pointerdown` and pass those originals for every move. This should be fixed during Chunk 5 migration.

#### Text metrics parity

Editor's `getTextBounds` in `editor/elements/text.ts` may not match the full text wrapping behavior in `app/internal/element-actions/text.ts`. Before replacing legacy text helpers, verify that the visual coordinates and line wrapping produce identical results. Add focused tests if behavior differs.

#### `sanitizeCanvasSize` — Small pure helper

Lives in `app/internal/project-file.ts`. Used by `CanvasResizeHandles.svelte` via deep import `@app/internal/canvas`. If pure validation, export from `@maply/model`; otherwise add as a small editor canvas helper. Verify during Chunk 1.
