# Rules

- Keep `@app` curated. Do not turn `app/index.ts` into a barrel. Shared types go in `@app/types`.
- Keep `@app/effect` Effect-native. Export only Effect-facing workflows, tagged errors, services, layers, and runtime pieces from it.
- Keep local names short when context is obvious: `db`, `req`, `txn`. Reserve long names for public services, errors, and exported types.
- Prefer plain variable names over narrated ones when the scope already tells the story.
- Do not repeat enclosing context in names. If the file/module already provides the context, drop it from locals and private helpers.
- Do not export error union aliases like `FooError = A | B`. Use tagged errors directly at the seam.
- Keep pure helpers pure. Do not make a shared helper return different `Effect.fail(...)` types for different callers.
- Raise tagged Effect errors at the workflow boundary that owns them.
- Add comments only for dense blocks where they materially improve reading speed. Prefer one pinpoint block comment over many line comments.
