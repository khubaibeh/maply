# @maply/io

External format conversion for Maply model data.

This package owns untrusted input/output boundaries for project data. It should grow around formats and validation rules, not editor state or storage details.

## Responsibilities

- Create, serialize, parse, and assign Maply project-file packages.
- Export projects to standalone SVG with embedded assets and recovery metadata.
- Import SVG through Maply recovery metadata, Synoptic fallback, and generic fallback parsing.
- Validate and prepare image/SVG input for safe application use.
- Surface typed Effect errors from IO boundaries.

## Source Modules

- `src/project/`: Maply project-file format constants, packaging, parsing, assignment, and asset-reference checks.
- `src/svg/export/`: SVG rendering from a Maply project and image assets.
- `src/svg/import/`: SVG recovery, Synoptic parsing, generic fallback parsing, and import warnings.
- `src/image/`: MIME checks and SVG safety validation for uploaded images.
- `src/effect/`: Effect-native API, runtime facade, layers, and public tagged errors.

## Exports

- `@maply/io`: pure constants and TypeScript helpers.
- `@maply/io/types`: TypeScript types for IO payloads.
- `@maply/io/effect`: Effect-native project file workflows and typed errors.
- `@maply/io/effect/program`: handled Promise-based program facade used by the non-Effect API.

## Boundaries

Use `@maply/model` for model shapes. Keep browser storage, editor workflows, and Svelte UI outside this package.

This package may validate files and convert formats, but it should not decide when a user confirms replacement, where a download is saved, how warnings are displayed, or how imported data is persisted. Those decisions belong to `editor/` and `src/`.

## Common Imports

```ts
import { project, svg, validateMimeType } from "@maply/io";
import type { ProjectFilePackage, SvgOptions } from "@maply/io/types";
import { ProjectFileSchemaError } from "@maply/io/effect";
```

## Checks

Run `pnpm --filter @maply/io test` for package tests and `pnpm --filter @maply/io check` for TypeScript.
