# @maply/io

External format conversion for Maply model data.

The package starts with project file packaging under `src/project`. It should grow around IO boundaries, not editor state or storage details.

## Exports

- `@maply/io`: pure constants and TypeScript helpers.
- `@maply/io/types`: TypeScript types for IO payloads.
- `@maply/io/effect`: Effect-native project file workflows and typed errors.

## Boundaries

Use `@maply/model` for model shapes. Keep browser storage, editor workflows, and Svelte UI outside this package.
