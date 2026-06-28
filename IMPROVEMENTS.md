# Improvements

- `App.create`, `App.geometry`, `App.text`, and `App.validate` are thin compatibility facades over `$lib/app/core/*` and `$lib/app/domain/*`; move ownership into `app/` once the state migration is complete.
- Revisit helper naming after ownership moves. Some names are clearer than the old ones, but they still reflect legacy implementation seams more than final domain seams.
- Split broad helper bags by responsibility once callers stabilize. In particular, `App.geometry` currently mixes generic geometry, path editing, and image render calculations.
- Remove type dependencies that still originate in legacy helper files, especially `ResizeHandle` and `ElementNameValidation`, by giving them app-owned homes.
- Consolidate duplicated SVG pointer/screen-to-world helpers that are currently reimplemented across multiple canvas components.
