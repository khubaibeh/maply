# Migration Findings

Use this file to record facts discovered during the package migration that should not be fixed in the same chunk. Keep entries specific enough that someone else can pick them up without rediscovering context.

Do not use this as a general TODO dump. Add an entry only when the migration exposes a concrete issue, missing test, risky dependency, unclear ownership, or follow-up refactor.

## Entry Format

```md
### Short imperative title

Type: missing-test | refactor | dependency | behavior-risk | cleanup | decision
Found in: path/to/file.ts
Migration chunk: short description or PR/link
Status: open | planned | done | rejected

Describe the finding in one short paragraph. Include the behavior or module seam involved, why it matters, and what should verify the fix.
```

## Open Findings

### Complete hydrated element normalization

Type: behavior-risk
Found in: `editor/session/load.ts`
Migration chunk: editor session lifecycle
Status: planned

`loadEditorSession` now clamps hydrated elements to the persisted canvas through editor-owned bounds helpers. Before `src` switches to `Editor`, complete the remaining legacy normalization behavior: path bounds must handle non-linear imported SVG commands, and pure text metrics must be verified as an acceptable replacement for browser canvas measurement. `editor/` must not import `app/` or browser DOM APIs.

### Test IndexedDB version-3 upgrades

Type: missing-test
Found in: `packages/storage/src/indexed-db/service.ts`
Migration chunk: `@maply/storage` extraction
Status: planned

The storage test suite covers fresh database creation and project/image-asset replacement, but not upgrading an existing version-3 `maply` database. Add a fixture database at version 3 without the `image-assets.projectId` index, open it through storage, and verify that version 4 preserves records while creating the index.

### Replace legacy app consumers

Type: cleanup
Found in: `app/services/indexed-db.ts`, `app/services/project-repo.ts`, `app/runtime/browser-runtime.ts`, `app/internal/db.ts`, `app/internal/project-file.ts`, `app/internal/svg-import.ts`, `app/internal/svg-export.ts`
Migration chunk: package consumer replacement
Status: planned

`@maply/io`, `@maply/storage`, and `editor/` now have public seams, but `src/` still imports `@app` and therefore keeps legacy `app/` implementations alive. In one dedicated compatibility chunk, switch UI callers to `editor` plus package type/helper imports, preserve current client-only behavior, and delete duplicated legacy modules only after all callers are moved.

### Complete generic SVG import diagnostics

Type: behavior-risk
Found in: `packages/io/src/svg/import/parser-generic.ts`, `packages/io/src/svg/import/parser-synoptic.ts`, `packages/io/src/svg/types.ts`
Migration chunk: `@maply/io` SVG import fallback
Status: planned

Recovery SVG import is lossless and Synoptic/generic SVG import covers the currently supported primitives, but generic fidelity work remains. Emit the defined warning types with structured `source` data for incomplete and unsupported elements, transforms, groups, path commands, styles, viewBoxes, and positioned text; validate image data URL MIME/base64 payloads; and add focused coverage. The generic parser also needs independent ownership if its behavior diverges from Synoptic extraction. Keep this as a follow-up unless a caller requires one of these unsupported SVG features.

### Remove import/export panel state

Type: cleanup
Found in: `app/domain/project.ts`, `app/store/project.ts`, `src` UI consumers
Migration chunk: `@maply/model` setup
Status: open

`importExportState` is still part of the project model and app store, but it is not used by the UI anymore. Remove it from `app`, `src`, and the migrated model after package extraction is stable, including project defaults, project-file parsing, persistence merge logic, and any compatibility handling needed for persisted projects.

### Fix incremental rounding drift in crop-scale during image frame resize

Type: behavior-risk
Found in: `app/internal/image-assets.ts` (`getImageCropStateForFrameResize`), `src/components/canvas/ImageCropOverlay.svelte`
Migration chunk: editor element resize
Status: open

The legacy `resizeImageFrame` store action calls `getImageCropStateForFrameResize` on every incremental `pointermove` delta during a handle drag. Each call reads `previousRect.width` (which is `Math.round`ed) and derives `previousCombinedScale = previousRect.width / assetWidth`. Because rounding introduces ±0.5px per frame, accumulated over many small moves the `cropScale` drifts downward — producing a visible zoom-out during what should be a pure frame resize.

When porting to `editor/`, the caller must pass the **original pre-drag crop state** as `current` and the **original pre-drag frame** as `previous` for the entire drag gesture, with only `next` updating per-frame. This applies a single round at the end rather than N rounds during the drag. The pure `cropForFrameResize` function in `editor/image/crop.ts` is correct in isolation; the bug is a caller-pattern issue that must be addressed in the resize interaction wiring.

## Done Findings

### Extract editor composition module

Type: decision
Found in: `editor/`
Migration chunk: editor extraction
Status: done

`editor/` now owns the application-specific live editing seam. It exposes `Editor` from `editor/index.ts`, composes `@maply/model`, `@maply/io`, and `@maply/storage`, and does not import `app/` or `src/`. It covers session lifecycle, autosave, canvas/tool state, element creation/mutation, selection, clipboard, image upload/crop, project import/export, and SVG import/export. Active Svelte UI callers still need to move from `@app` to `editor` in the dedicated compatibility chunk.

### Make image replacement crash-atomic

Type: behavior-risk
Found in: `editor/image/upload.ts`
Migration chunk: editor image workflows
Status: done

`replaceImageAsset` now acquires the editor mutex, updates live project and asset state together, and persists the full project plus referenced asset set through `storage.project.replace`. The old separate save/delete sequence is no longer the editor path, reducing the crash window where persisted projects could reference deleted image assets. UI consumers still need to move from legacy `app` image replacement to `Editor.image.replace`/`Editor.image.fromFile`.

### Extract browser persistence

Type: decision
Found in: `packages/storage/src/indexed-db`, `packages/storage/src/project`, `app/services/indexed-db.ts`, `app/services/project-repo.ts`
Migration chunk: `@maply/storage` extraction
Status: done

`@maply/storage` now owns client-side IndexedDB persistence for projects and image assets. Its only public subpaths are `@maply/storage`, `@maply/storage/effect`, and `@maply/storage/types`; the root API handles tagged failures as values, while the Effect subpath exposes raw workflows and runtime wiring. The package preserves IndexedDB schema version 4, retries failed opens, and atomically replaces a project's asset set. Legacy app modules remain until the dedicated consumer-replacement chunk.

### Extract external format boundaries

Type: decision
Found in: `packages/io/src/project`, `packages/io/src/svg`, `app/internal/project-file.ts`, `app/internal/svg-import.ts`, `app/internal/svg-export.ts`
Migration chunk: `@maply/io` external format extraction
Status: done

`@maply/io` now owns `.maply` project-file decoding and serialization plus SVG recovery/Synoptic conversion, using `@maply/model/effect` schemas as the source of truth. The active package boundary is `@maply/io`, not separate project or SVG codec packages. Legacy `app/internal/*` implementations remain until the dedicated consumer migration chunk. The package is verified through type checks and SVG/project IO tests.
