# Editor Module

`editor/` is Maply's application-specific editing composition boundary. It is not a workspace package. It exposes a single `Editor` API that the SvelteKit UI can render and call without importing package internals directly.

The module composes reusable packages with live Svelte stores:

- `@maply/model` supplies project, element, canvas, camera, tool, and image asset types/defaults.
- `@maply/io` owns project-file, SVG, and image validation boundaries.
- `@maply/storage` owns IndexedDB persistence for projects and image assets.
- `editor/` owns live state, editing commands, lifecycle orchestration, autosave, and package composition.
- `src/` owns Svelte UI, browser events, dialogs, file pickers, downloads, and pointer interaction.

## Public API

Import the editor API from `editor`:

```ts
import { Editor } from "editor";
```

The API is grouped by workflow:

- `Editor.load(projectId?)`: hydrate the active editor session from storage.
- `Editor.state`: read-only Svelte stores for project, canvas, fill, tool, and image assets.
- `Editor.actions.canvas`: canvas frame, color, camera, pan, and zoom commands.
- `Editor.actions.tool`: active tool and temporary Space-to-hand commands.
- `Editor.element`: add, update, rename, translate, resize, reorder, and delete elements.
- `Editor.selection`: select, hover, select all, and crop-mode commands.
- `Editor.naming`: validate and autofix element names.
- `Editor.clipboard`: copy, paste, and read the in-memory editor clipboard.
- `Editor.image`: upload/replace image assets and edit image crop state.
- `Editor.project`: rename, create, import, export, SVG import, and SVG export commands.
- `Editor.create`: element factories used by UI pointer drafts.
- `Editor.save`: queue or flush autosave.

## Source Modules

- `canvas/`: canvas frame updates, camera movement, zoom limits, and tool state.
- `elements/`: element factories, mutation, geometry, resize, text metrics, path updates, and naming.
- `image/`: image upload/replacement, asset persistence composition, and crop commands.
- `project/`: project creation, rename, project-file import/export, and SVG import/export composition.
- `selection/`: selection, hover, crop-mode, clipboard, deletion, and layer ordering.
- `session/`: load and autosave lifecycle workflows.
- `state/`: Svelte stores for document, canvas/tool workspace state, image assets, and the mutation mutex.
- `types.ts`: editor-only state types that extend package model types with live UI state.

## Package Composition

Use packages at the seam where their responsibility begins:

- Session load/save uses `@maply/storage` to fetch and persist projects and referenced image assets.
- Project-file export gathers the current editor snapshot, then delegates packaging to `@maply/io.project.file`.
- Project-file import delegates validation/assignment to `@maply/io.project.file`, then applies the result through `@maply/storage.project.replace`.
- SVG export/import delegates conversion to `@maply/io.svg`, then applies valid imported payloads through the project import workflow.
- Image upload uses `@maply/io` for MIME/SVG validation and `@maply/storage` for persisted asset replacement.

## Boundaries

Keep `editor/` focused on application workflows. It may coordinate state, storage, IO, and model helpers, but it should not render UI or own browser event registration.

Keep these concerns outside `editor/`:

- Svelte components, dialogs, menus, and styling.
- Pointer draft rendering and DOM event listeners.
- File picker and download element creation.
- Theme preference and document-level browser effects.
- Generic reusable model, IO, or storage behavior that belongs in a package.

Keep these concerns inside `editor/`:

- Live project/canvas/tool/image-asset stores.
- Selection, hover, crop-editing, and clipboard state.
- Element mutation and canvas clamping invariants.
- Autosave queue/flush behavior.
- Atomic application of imported projects and image replacements.

## Error Handling

Editor commands that cross IO or storage boundaries return handled result objects where callers need to display a failure. UI code should surface those failures and decide presentation. Commands that update live state synchronously should preserve invariants before mutating stores.

Storage failures during background save/delete workflows are logged and should not break the live editor session.

## Related Docs

- [`packages/README.md`](../packages/README.md): package responsibilities and dependency direction.
- [`docs/internal/editor-workflows.md`](../docs/internal/editor-workflows.md): detailed workflow inventory and migration notes.
