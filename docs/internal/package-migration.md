# Package Migration

Maply is extracting root-level `app/` code into named `@maply/*` capability packages and the application-specific `editor/` module first. The `src/` SvelteKit UI is phase 2. During phase 1, `src/` import replacements happen once, in a single compatibility chunk, after the migrated interfaces are ready.

The first phase is focused on hollowing out `@app` by extracting cohesive capability packages and the editor composition module. Prefer copy, switch imports, then delete the old `app/` source in one focused chunk. Do not move the whole `app/` tree into a package or `editor/` as a holding pen unless there is a concrete compatibility blocker.

Do not edit generated shadcn files under `src/lib/components/ui/*` or their future package equivalent except through the shadcn workflow. Keep UI-system changes separate from architecture changes.

Run verification after each chunk with `pnpm check`, `pnpm test`, and `pnpm build`. Do not run the dev server.

Use pnpm catalogs for shared dependency versions across packages. New package manifests should reference catalog entries instead of repeating concrete versions when a dependency is shared by more than one package or is part of the app's standard toolchain. Root application modules do not need package manifests.

## Target Shape

The intended dependency flow is one-way: `web` depends on `editor/`, `editor/` depends on model/storage/IO modules, IO modules depend on model definitions, and pure model code depends on nothing browser-specific.

All extracted packages use the `@maply/*` name prefix. Import model code as `@maply/model`, external format boundaries as `@maply/io`, and storage code as `@maply/storage`. The application-specific editor composition module lives at the root as `editor/` and is imported as `editor`.

`packages/web` is phase 2. It will eventually become the SvelteKit shell and own routes, layouts, global CSS, shadcn components, static assets, and app wiring. Do not move `src/` there during the `@app` migration. Keep direct DOM interaction and UI rendering in `src`; they call the root `editor/` module.

`editor/` owns live editor state and commands. It is the small interface used by the UI for selection, canvas changes, tools, element edits, clipboard, autosave, and project lifecycle. It composes reusable packages for Maply and is not itself a reusable package.

`packages/model` owns pure model definitions: Effect schemas, inferred TypeScript types, constants, default project creation, and small pure helpers. Its schemas are the source of truth for model shapes. It should not own decoding workflows for unknown input, project-file compatibility, migrations, persistence recovery, or SVG parsing.

`packages/storage` owns persistence. IndexedDB details stay behind this module's interface.

`packages/io` owns external-format boundaries. It currently owns `.maply` project files and SVG import/export, including unknown-input decoding, project-file compatibility normalization, tagged errors, and recovery metadata. It depends on `@maply/model` schemas instead of redefining model shapes.

Keep project-file and SVG implementations in their own `@maply/io` feature folders. Share only format-neutral primitives such as record guards and typography ratios.

During the `@app` migration, prefer Effect for workflows, persistence, resource management, typed errors, and testable seams when it materially benefits the Effect ecosystem. Do not wrap trivial pass-throughs or local synchronous state changes in Effect just to make them look Effect-shaped.

Do not create all packages at once unless the change remains mechanical. A package seam is only useful when it removes knowledge from callers, not when it wraps the same methods in another pass-through layer. Keep app-specific composition such as `editor/` as a root module rather than a package.

## Migration Rules

Keep each change to one intent. A directory move should not also rewrite Effect usage, rename stores, or split canvas interaction state.

Keep dependency versions centralized. Add or update shared versions through pnpm catalogs, then consume them from package manifests. Avoid per-package version drift unless the package has a documented reason to diverge.

Prefer moving before refactoring. Preserve imports through temporary aliases when that makes the diff smaller and safer.

Reject pass-through modules. If a new module only forwards the same parameters to another module, do not add it. Move behavior behind a smaller interface or wait.

Keep effects at the edges. Pure model code may expose Effect schemas, but it must not import Svelte, browser globals, IndexedDB, Effect runtime wiring, routes, UI components, or boundary decode workflows.

Make dependency direction enforceable. Before relying on package or root-module boundaries, add tooling that fails CI for forbidden imports.

Mark old paths as temporary during migration. Root-level `app/` and `src/` are legacy locations once equivalent package paths exist.

Do not leave half-finished migrations untracked. Any chunk that introduces a new pattern must also list remaining old-pattern call sites or point to the follow-up task.

## Package Shape

Every extracted package should use the `@maply/*` name prefix and expose a small public interface from `src/index.ts`. Callers should import from the package root, such as `@maply/model`, unless a package explicitly documents an additional export path. `@maply/model` also documents `@maply/model/types` for inferred TypeScript types and `@maply/model/effect` for Effect schemas. `@maply/io` documents `@maply/io/effect` for raw Effect workflows and tagged IO errors.

Each package should have a `package.json`, `tsconfig.json`, and `src/index.ts`. The only files allowed directly under a package `src/` root are `index.ts`, `types.ts`, and `effect.ts`. Put all other implementation files in meaningful folders that reflect the package's model. Avoid catch-all folders like `core` unless there is a specific reason. Use `src/internal/*` for private implementation details that callers must not import. Keep public types either in `src/index.ts` or a deliberately exported `src/types.ts` when that makes the interface clearer.

Package manifests should use pnpm catalog references for shared dependencies. Do not repeat concrete versions inside package manifests unless the package intentionally diverges and documents why.

Package checks should be runnable through package scripts. Pure TypeScript packages should support `pnpm --filter <package> check`.

Package-specific README files should document exported subpaths and ownership boundaries. Keep root documentation app-level; use `packages/README.md` as the package index.

## First Chunks

1. Add workspace package globs to `pnpm-workspace.yaml`.
2. Create `@maply/model` as the first real extraction target.
3. Keep `@maply/model` focused on schemas, inferred types, constants, defaults, and pure helpers.
4. Keep the `@app` alias working until the single `src/` import-replacement chunk.
5. Extract project decoding/import/export and SVG conversion into `@maply/io` rather than adding boundary workflows to `@maply/model`. Completed: `@maply/io` exposes handled root APIs and raw `@maply/io/effect` workflows.
6. Add import-boundary tooling before extracting `storage` or `editor/`. Completed: dependency-cruiser validates package and root-module dependency direction.

## Current State

`@maply/model` owns schemas, inferred types, defaults, constants, and pure model helpers. `@maply/io` owns the current external boundaries:

- `.maply` create, serialize, parse, and assign workflows under `project.file`.
- SVG recovery export/import and Synoptic SVG import under `svg`.
- Root `@maply/io` exposes handled Promise-based operations.
- `@maply/io/effect` exposes raw Effect workflows, tagged errors, and runtime wiring.

`@maply/storage` owns browser-only IndexedDB persistence for projects and image assets:

- Root `@maply/storage` exposes handled Promise-based project and image-asset operations.
- `@maply/storage/effect` exposes raw Effect workflows, tagged errors, services, layers, and runtime wiring.
- `@maply/storage/types` exposes its public TypeScript types.
- Project and image-asset replacement is atomic across both IndexedDB stores.

The legacy IO equivalents remain in `app/internal/project-file.ts`, `app/internal/svg-import.ts`, and `app/internal/svg-export.ts`. The legacy storage equivalents remain in `app/services/indexed-db.ts`, `app/services/project-repo.ts`, `app/runtime/browser-runtime.ts`, and `app/internal/db.ts`. Do not migrate `app/` or `src/` consumers until the dedicated import-replacement chunk.

## Editor Module Shape

The root `editor/` module is the application composition boundary for live editing. Its `index.ts` entrypoint is imported through the `editor` alias. It may depend on `@maply/model`, `@maply/io`, `@maply/storage`, and Svelte stores, but must not import `src/`, `packages/web`, or legacy `app/` code. Keep DOM event handling, component rendering, routes, global theme behavior, and shadcn components in `src/`.

`docs/internal/editor-workflows.md` is the migration reference for current user-visible behavior. Update it when a migration chunk discovers or intentionally changes a workflow invariant.
