# Agent Rules

- Apply the repo naming skill for every new or renamed identifier.
- Phase 1 is `@app` extraction only; do not refactor `src` until the dedicated phase.
- Extract into named packages like `@maply/model`; do not create holding-pen packages.
- Keep application-specific editor composition in the root `editor/` module, imported through the `editor` alias. It may use capability packages but must not import `src/` or legacy `app/` code.
- Package `src/` roots may contain only `index.ts`, `types.ts`, and `effect.ts`.
- Put package implementation under meaningful folders; avoid catch-all folders like `core` unless there is a specific reason.
- Use explicit package exports; avoid barrels and deep imports unless documented.
- Keep `@maply/model` pure: schemas, inferred types, constants, defaults, and pure helpers only.
- Put unknown-input decoding, migrations, project-file compatibility, and SVG parsing in codec packages that depend on `@maply/model`.
- Use pnpm catalogs for shared dependency versions.
- Do not edit shadcn-generated files under `src/lib/components/ui/*`.
