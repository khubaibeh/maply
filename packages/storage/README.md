# @maply/storage

Browser persistence for Maply projects and image assets.

This package owns IndexedDB access and persisted-project recovery. It depends on `@maply/model` for project shapes and defaults; editor state, external formats, and Svelte UI stay outside this package.

## Exports

- `@maply/storage`: handled Promise-based project persistence.
- `@maply/storage/types`: public TypeScript types.
- `@maply/storage/effect`: Effect workflows, services, layers, and tagged storage errors.
