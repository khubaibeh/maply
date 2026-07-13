# Agent Rules

- Apply the repo naming skill for every new or renamed identifier.
- The package/editor migration is complete. Preserve the public `Editor` surface while keeping behavior in its owning editor module.
- Extract into named packages like `@maply/model`; do not create holding-pen packages.
- Keep application-specific editor composition in the root `editor/` module, imported through the `editor` alias. It may use capability packages but must not import `src/`.
- Package `src/` roots should contain only public entrypoints (`index.ts`, `types.ts`, `effect.ts`) plus deliberately shared package-internal primitives such as `common.ts`; put feature implementation under named folders.
- Put package implementation under meaningful folders; avoid catch-all folders like `core` unless there is a specific reason.
- Use explicit package exports; avoid barrels and deep imports unless documented.
- Keep `@maply/model` pure: schemas, inferred types, constants, defaults, and pure helpers only.
- Put unknown-input decoding, migrations, project-file compatibility, and SVG parsing in `@maply/io`, which depends on `@maply/model`.
- Use pnpm catalogs for shared dependency versions.
- Do not edit shadcn-generated files under `src/lib/components/ui/*`.
