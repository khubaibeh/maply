# Migration Findings

Use this file to record facts discovered during the package migration that should not be fixed in the same chunk. Keep entries specific enough that someone else can pick them up without rediscovering context.

Do not use this as a general TODO dump. Add an entry only when the migration exposes a concrete issue, missing test, risky dependency, unclear ownership, or follow-up refactor.

## Entry Format

```md
### Short imperative title

Type: missing-test | refactor | dependency | behavior-risk | cleanup | decision
Found in: path/to/file.ts
Migration chunk: short description or PR/link
Status: open | planned | done | rejected

Describe the finding in one short paragraph. Include the behavior or module seam involved, why it matters, and what should verify the fix.
```

## Open Findings

### Remove import/export panel state

Type: cleanup
Found in: `app/domain/project.ts`, `app/store/project.ts`, `src` UI consumers
Migration chunk: `@maply/model` setup
Status: open

`importExportState` is still part of the project model and app store, but it is not used by the UI anymore. Remove it from `app`, `src`, and the migrated model after package extraction is stable, including project defaults, project-file parsing, persistence merge logic, and any compatibility handling needed for persisted projects.

## Done Findings

No findings completed yet.
