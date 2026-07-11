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

### Normalize and clamp hydrated editor elements

Type: behavior-risk
Found in: `editor/session/load.ts`
Migration chunk: editor session lifecycle
Status: planned

`loadEditorSession` currently applies persisted elements without the legacy normalization and canvas clamping performed by `app/store/project.ts`. Before `src` switches to `Editor`, add editor-owned pure normalization and bounds helpers, then apply them during hydration. The legacy text bounds helper uses browser canvas measurement, so decide whether `src` provides that measurement or the editor adopts a documented pure fallback; `editor/` must not import `app/` or browser DOM APIs.

### Test IndexedDB version-3 upgrades

Type: missing-test
Found in: `packages/storage/src/indexed-db/service.ts`
Migration chunk: `@maply/storage` extraction
Status: planned

The storage test suite covers fresh database creation and project/image-asset replacement, but not upgrading an existing version-3 `maply` database. Add a fixture database at version 3 without the `image-assets.projectId` index, open it through storage, and verify that version 4 preserves records while creating the index.

### Replace legacy package consumers

Type: cleanup
Found in: `app/services/indexed-db.ts`, `app/services/project-repo.ts`, `app/runtime/browser-runtime.ts`, `app/internal/db.ts`, `app/internal/project-file.ts`, `app/internal/svg-import.ts`, `app/internal/svg-export.ts`
Migration chunk: package consumer replacement
Status: planned

`@maply/io` and `@maply/storage` have complete public seams, but `app/` still uses their legacy implementations. In one dedicated compatibility chunk, switch the app-facing workflows and runtime wiring to package imports, preserve current client-only behavior, and delete the duplicated legacy modules only after all callers are moved.

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

### Make image replacement crash-atomic

Type: behavior-risk
Found in: `editor/image/upload.ts`
Migration chunk: editor image workflows
Status: open

`replaceImageAsset` persists the new asset, mutates in-memory state, then independently deletes the old asset as three separate operations. A crash or tab close after old-asset deletion but before the separately queued project save leaves persisted project data referencing a deleted asset. Use `storage.project.replace` (or an equivalent transactional boundary) to commit the changed project record and its complete asset set atomically. The concurrent-replacement race (two rapid replacements applying out of order) should be addressed in the same pass.

## Done Findings

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
