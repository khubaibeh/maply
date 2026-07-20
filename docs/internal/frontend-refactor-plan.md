# Frontend Refactor Architecture

Status: completed 2026-07-13.

This document records the implemented `src/` frontend refactor, its ownership decisions, and
the verification required to preserve those decisions. It supersedes the original speculative
file plan.

## Scope

The implementation changed:

- `src/components/` feature modules and composition roots.
- `src/routes/layout.css` for global input behavior and canvas interaction tokens.
- `tests/ui/` for frontend interaction transition tests.
- `.dependency-cruiser.cjs` and `package.json` to enforce `src/` dependency direction.

`src/lib/components/ui/` remains generated shadcn-svelte code and was not modified.

## Ownership

The repository's existing application seams remain authoritative:

- `src/` owns Svelte presentation, browser events, pointer interactions, dialogs, file pickers,
  downloads, and visual draft state.
- `editor/` owns live editing state, mutation invariants, autosave, selection, crop state, and
  application workflow composition.
- `@maply/model` owns reusable model types, parsing, and pure geometry.
- `@maply/io` owns project-file and SVG external-format behavior.
- `@maply/storage` owns persistence.

Frontend modules call the public `Editor` interface. They do not reproduce mutation or storage
policy and do not import private editor entry points.

## Implemented Structure

```text
src/components/
├── canvas/
│   ├── interaction/
│   │   ├── drag.ts
│   │   ├── element-move.svelte.ts
│   │   ├── handles.ts
│   │   ├── pointer-drag.svelte.ts
│   │   └── svg.ts
│   ├── shapes/
│   │   ├── CircleShape.svelte
│   │   ├── ImageShape.svelte
│   │   ├── PathShape.svelte
│   │   ├── RectShape.svelte
│   │   └── TextShape.svelte
│   └── existing canvas composition and overlay components
├── core/
│   ├── canvas-area/
│   │   ├── area.state.svelte.ts
│   │   ├── camera.ts
│   │   ├── context-menu.svelte.ts
│   │   ├── drawing-session.svelte.ts
│   │   ├── drawing.ts
│   │   ├── path-drawing.ts
│   │   └── path-session.svelte.ts
│   └── shortcuts.ts
├── elements-panel/
│   ├── ElementRow.svelte
│   ├── ElementRowContextMenu.svelte
│   ├── ElementsPanel.svelte
│   ├── reorder.ts
│   └── use-reorder.svelte.ts
├── project-menu/
│   ├── browser-download.ts
│   ├── ImportProjectDialog.svelte
│   ├── NewProjectDialog.svelte
│   ├── ProjectMenuOverlay.svelte
│   └── project-transfer.svelte.ts
└── properties/
    ├── CircleProperties.svelte
    ├── ElementProperties.svelte
    ├── ImageProperties.svelte
    ├── PathProperties.svelte
    ├── PropertyField.svelte
    ├── RectProperties.svelte
    └── TextProperties.svelte
```

## Module Contracts

### Canvas Interaction

`canvas/interaction/pointer-drag.svelte.ts` owns one active pointer lifecycle per consumer. Its
interface provides:

- Pointer ID filtering.
- Exact listener acquisition and release.
- Cleanup when a component is destroyed.
- Cancellation when a drag is replaced.
- Incremental `delta` and pointer-down-relative `totalDelta`.
- Per-invocation SVG projection, avoiding shared mutable drag configuration.

Consumers deliberately choose displacement semantics:

- Element movement, crop panning, element resizing, and canvas resizing use `delta`.
- Crop-frame resizing and path-vertex movement use `totalDelta` from immutable pointer-down
  state.

`element-move.svelte.ts` is the single owner of canvas element selection-and-move policy. Both
rendered shapes and selection outlines delegate pointerdown handling to it.

`svg.ts` and `handles.ts` are canvas-feature modules. They are not application-wide utilities.
Their location keeps DOM/SVG interaction knowledge local to the feature that owns it.

### Shape Rendering

`ElementShapes.svelte` owns iteration, hover, hit targets, and dispatch. Type-specific shape
modules receive prepared rendering values and contain no selection or drag policy.

Rendering and property editing use separate exhaustive dispatchers. A shared component registry
was intentionally rejected because it would couple the canvas and properties feature trees and
would complicate discriminated Svelte prop typing.

Adding an element type requires explicit entries in both dispatchers. This duplication is an
intentional dependency seam, not shared policy.

### Canvas Area

`core/canvas-area/area.state.svelte.ts` is the lifecycle shell. It is the sole owner of viewport
resource registration, including resize observation and global camera/drawing keyboard and
pointer listeners.

The shell composes focused modules:

- `camera.ts`: pure zoom-at-pointer and pan calculations.
- `drawing-session.svelte.ts`: shape draft state, previews, and commit orchestration.
- `path-session.svelte.ts`: path draft state, snapping, close detection, and commit.
- `path-drawing.ts`: pure canvas clipping and path transition calculations.
- `context-menu.svelte.ts`: context target state and command dispatch.

Submodules do not independently register global listeners, so listener ordering and cleanup
remain traceable in one place.

### Properties

`properties/ElementProperties.svelte` is a thin type dispatcher. Each element-type module owns
its form behavior and invokes public `Editor` commands. Numeric parsing remains in
`@maply/model`; mutation and clamping invariants remain in `Editor`.

`PropertyField.svelte` owns only repeated label/input accessibility and event translation. It
does not create a parallel mutation layer or mirror the entire shadcn Input interface.

### Elements Panel

The elements panel separates list composition, row editing, row context actions, and reorder
lifecycle. `use-reorder.svelte.ts` owns delayed activation, window listeners, auto-scroll, click
suppression, commit, cancellation, and destruction cleanup.

`reorder.ts` contains pure reversed-paint-order conversion and preview transitions so the most
error-prone index behavior is testable without DOM machinery.

### Project Menu

`project-transfer.svelte.ts` owns browser transfer state while delegating editing workflows to
`Editor.project` and format parsing/serialization to `@maply/io`.

The UI now:

- Surfaces handled and unexpected failures instead of silently returning or swallowing throws.
- Preserves SVG parser source and warning diagnostics in the replacement dialog.
- Removes production debug logging.
- Keeps file picker, Blob, object URL, download, dialog, and reload behavior in `src/`.

`browser-download.ts` contains the pure filename projection and browser download adapter.

## Visual Tokens

Canvas selection and handle colors are semantic CSS custom properties in
`src/routes/layout.css`:

- `--canvas-selection`
- `--canvas-handle-fill`

Both have light and dark theme values. Context-specific handle dimensions remain local because
element handles, crop handles, path vertices, and canvas handles intentionally have different
sizes and hit targets.

The global `.no-spinner` utility also lives in `layout.css`; no component owns hidden global CSS
required by another component.

## Keyboard Helpers

`core/shortcuts.ts` owns `getShortcutTool`, `getArrowDelta`, and `isEditingText`. All three are
used only by `EditorScreen.svelte`, so moving them to a global utility folder would widen their
scope without reuse. Sidebar dimensions are local composition constants in `EditorScreen`.

Selection modifier checks remain direct `ctrlKey || metaKey` expressions. The expression is
short, has no platform policy beyond browser modifier state, and does not justify a shared
module.

## Deleted Files

- `src/components/ElementProperties.svelte`
- `src/components/core.ts`
- `src/components/core/ProjectMenuOverlay.svelte`
- `src/components/core/area.state.svelte.ts`
- `src/components/left-sidebar/ElementsSection.svelte`
- `src/components/left-sidebar/ProjectSection.svelte`

The former `left-sidebar/` directory is empty and removed.

## Dependency Enforcement

`pnpm check:deps` now analyzes `src`, `editor`, and `packages`. Dependency Cruiser rejects:

- Circular dependencies.
- Imports from `src` into private editor entry points.
- Imports from `src/lib` back into application components, editor, or packages.
- Existing package/editor direction violations.

Cross-folder source imports use configured aliases. Relative imports are used within one feature
folder.

## Verification

The completed refactor passes:

```sh
pnpm check
pnpm test
pnpm build
pnpm exec eslint --ignore-pattern "src/lib/components/ui/**" .
git diff --check
```

Verification result at completion:

- Svelte and TypeScript diagnostics: zero errors and warnings.
- Dependency Cruiser: 231 modules, zero violations.
- Tests: 209 passing across editor, model, IO, and storage suites.
- Static production build and prerender: passing.
- ESLint and whitespace validation: passing.

The development server is not part of verification and was not run.
