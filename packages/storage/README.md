# @maply/storage

Browser persistence for Maply projects and image assets.

This package owns IndexedDB access and persisted-project recovery. It depends on `@maply/model` for project shapes and defaults; editor state, external formats, and Svelte UI stay outside this package.

## Responsibilities

- Persist and fetch projects by ID.
- Save, fetch, and delete image assets referenced by projects.
- Reset the active project to blank or sample defaults.
- Replace a project and its image assets atomically at the repository boundary.
- Provide Effect-native services, layers, and tagged storage errors.

## Source Modules

- `src/indexed-db/`: low-level IndexedDB service and open/store errors.
- `src/project/repository.ts`: project and image-asset repository workflows.
- `src/effect/`: Effect-native API, runtime facade, layers, and public storage errors.

## Exports

- `@maply/storage`: handled Promise-based project persistence.
- `@maply/storage/types`: public TypeScript types.
- `@maply/storage/effect`: Effect workflows, services, layers, and tagged storage errors.

## Boundaries

Use `@maply/model` for stored shapes. Keep project-file parsing, SVG conversion, upload UI, editor selection state, autosave debounce, and Svelte stores outside this package.

Storage should not know why a project is being replaced. The caller decides whether the source is a reset, project-file import, SVG import, or image replacement.

## Common Imports

```ts
import { storage } from "@maply/storage";
import type { ResetProjectOptions, StorageResult } from "@maply/storage/types";
import { ProjectRepository } from "@maply/storage/effect";
```

## Checks

Run `pnpm --filter @maply/storage test` for package tests and `pnpm --filter @maply/storage check` for TypeScript.
