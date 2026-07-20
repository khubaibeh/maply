# Packages

Reusable Maply code lives in private workspace packages under `@maply/*`. These packages are deliberately smaller than the SvelteKit app and should stay free of Svelte UI, live editor state, browser event routing, and application dialogs.

The package layer is the reusable foundation. The `editor/` module composes these packages into Maply's application-specific editing API, and `src/` renders the UI around that API.

## Packages

- [`@maply/model`](./model): pure project model schemas, inferred types, defaults, and small helpers.
- [`@maply/io`](./io): project files, SVG import/export, image validation, and other external format conversions.
- [`@maply/storage`](./storage): browser persistence for projects and image assets.

## Application Modules

- [`editor/`](../editor): Maply-specific editor state, commands, lifecycle, and autosave. It composes the reusable packages for this application and is not a workspace package.

## Dependency Direction

Package dependencies should remain one-way:

- `@maply/model` has no Maply workspace package dependencies.
- `@maply/io` depends on `@maply/model` for project shapes.
- `@maply/storage` depends on `@maply/model` for persisted project and asset shapes.
- `editor/` depends on the packages and Svelte stores.
- `src/` depends on `editor/` and UI components.

Do not make packages import from `editor/`, `app/`, or `src/`. If reusable behavior is needed by both the editor and another caller, move it into the package that owns the boundary.

## Public Surfaces

Each package exposes three import styles when applicable:

- `@maply/<name>` for the application-friendly facade.
- `@maply/<name>/types` for TypeScript-only public types.
- `@maply/<name>/effect` for Effect-native workflows, services, layers, and tagged errors.

Prefer the facade from `editor/` and UI code unless the caller is already Effect-native or needs a specific tagged error/service.

## Checks

Use package-scoped scripts while working on a package:

- `pnpm --filter @maply/model test`
- `pnpm --filter @maply/io test`
- `pnpm --filter @maply/storage test`

Use `pnpm check` before integrating package changes with the app dependency graph.
