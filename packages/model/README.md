# @maply/model

Pure Maply project model definitions.

This package owns the model shapes, not boundary decoding workflows. Use it for shared schemas, inferred TypeScript types, constants, defaults, and small pure helpers.

## Exports

- `@maply/model`: runtime defaults and pure helpers.
- `@maply/model/types`: TypeScript types inferred from the schemas.
- `@maply/model/effect`: Effect schemas for model shapes.

## Boundaries

Keep decoding of unknown input outside this package. Project file parsing, persisted compatibility, migrations, and SVG import/export should live in codec-specific packages that depend on `@maply/model`.
