# @maply/model

Pure Maply project model definitions.

This package owns the model shapes, not boundary decoding workflows. Use it for shared schemas, inferred TypeScript types, constants, defaults, and small pure helpers.

## Responsibilities

- Define the canonical project, canvas, camera, element, tool, and stored image asset shapes.
- Export Effect schemas for callers that need runtime validation at a boundary.
- Export inferred TypeScript types for app, editor, IO, storage, and tests.
- Provide default project/sample project factories.
- Provide small pure helpers for project geometry, tool checks, and input parsing.

## Source Modules

- `src/project/schema.ts`: Effect schemas and inferred core model types.
- `src/project/default/`: blank and sample project records.
- `src/project/geometry.ts`: pure model-level geometry predicates.
- `src/project/tool.ts`: drawing tool constants and checks.
- `src/project/validation.ts`: pure parsing helpers for numeric and color inputs.

## Exports

- `@maply/model`: runtime defaults and pure helpers.
- `@maply/model/types`: TypeScript types inferred from the schemas.
- `@maply/model/effect`: Effect schemas for model shapes.

## Boundaries

Keep decoding of unknown input outside this package. Project file parsing, persisted compatibility, migrations, and SVG import/export should live in codec-specific packages that depend on `@maply/model`.

Do not add editor state here. Selection, hover, crop editing state, autosave, live Svelte stores, and UI form state belong in `editor/` or `src/`.

## Common Imports

```ts
import { createDefaultProject, isPointInsideCanvas } from "@maply/model";
import type { Element, Project } from "@maply/model/types";
import { ProjectSchema } from "@maply/model/effect";
```

## Checks

Run `pnpm --filter @maply/model test` for package tests and `pnpm --filter @maply/model check` for TypeScript.
