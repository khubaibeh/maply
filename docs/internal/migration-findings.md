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

### Complete generic SVG import diagnostics

Type: behavior-risk
Found in: `packages/io/src/svg/import/parser-generic.ts`, `packages/io/src/svg/import/parser-synoptic.ts`, `packages/io/src/svg/types.ts`
Migration chunk: `@maply/io` SVG import fallback
Status: planned

Recovery SVG import is lossless and Synoptic/generic SVG import covers the currently supported primitives, but generic fidelity work remains. Emit the defined warning types with structured `source` data for incomplete and unsupported elements, transforms, groups, path commands, styles, viewBoxes, and positioned text; validate image data URL MIME/base64 payloads; and add focused coverage. The generic parser also needs independent ownership if its behavior diverges from Synoptic extraction. Keep this as a follow-up unless a caller requires one of these unsupported SVG features.

## Done Findings

### Test IndexedDB version-3 upgrades

Type: missing-test
Found in: `packages/storage/tests/storage.test.ts`
Migration chunk: `@maply/storage` extraction
Status: done

A version-3 fixture without the `image-assets.projectId` index is upgraded through the production storage layer. The test verifies project and image records survive and the version-4 index is created.

### Complete hydrated element normalization

Type: behavior-risk
Found in: `editor/session/load.ts`, `editor/session/normalize.ts`, `editor/elements/path.ts`
Migration chunk: editor session lifecycle
Status: done

Hydration again normalizes legacy names, path fields, text dimensions, image references, and crop values before clamping. Path bounds restore legacy curve and arc handling, while text bounds use the same browser metrics as rendering when available.

### Replace legacy app consumers

Type: cleanup
Found in: `src/`, `editor/`, `tests/`, legacy `app/`
Migration chunk: package consumer replacement
Status: done

Production callers now use `Editor` and `@maply/*`, replacement package/editor tests cover the retired legacy suites, and the `app/` tree plus `@app` alias were removed.

### Fix incremental rounding drift in crop-scale during image frame resize

Type: behavior-risk
Found in: `editor/image/commands.ts`, `src/components/canvas/ImageCropOverlay.svelte`
Migration chunk: editor element resize
Status: done

The resize interaction captures the original image frame and crop state at pointerdown. Every pointermove sends the total drag delta with that snapshot, so crop/frame calculations no longer compound rounded intermediate values.

### Extract editor composition module

Type: decision
Found in: `editor/`
Migration chunk: editor extraction
Status: done

`editor/` owns the application-specific live editing seam. It exposes `Editor` from `editor/index.ts`, composes `@maply/model`, `@maply/io`, and `@maply/storage`, and does not import `app/` or `src/`. Active Svelte callers use this surface.

### Make image replacement crash-atomic

Type: behavior-risk
Found in: `editor/image/upload.ts`
Migration chunk: editor image workflows
Status: done

`replaceImageAsset` acquires the editor mutex, rejects missing referenced assets, persists the full project and asset set atomically through `storage.project.replace`, and only then publishes the new live state. Persistence failure therefore leaves the prior live project and assets unchanged.

### Extract browser persistence

Type: decision
Found in: `packages/storage/src/indexed-db`, `packages/storage/src/project`
Migration chunk: `@maply/storage` extraction
Status: done

`@maply/storage` owns client-side IndexedDB persistence for projects and image assets. Its public subpaths are `@maply/storage`, `@maply/storage/effect`, and `@maply/storage/types`; version-3 upgrade and atomic project/asset replacement behavior are covered by package tests.

### Extract external format boundaries

Type: decision
Found in: `packages/io/src/project`, `packages/io/src/svg`
Migration chunk: `@maply/io` external format extraction
Status: done

`@maply/io` owns `.maply` project-file decoding and serialization plus SVG recovery/Synoptic conversion, using `@maply/model/effect` schemas as the source of truth. Project-file, SVG, and image-security behavior is covered by package tests.
