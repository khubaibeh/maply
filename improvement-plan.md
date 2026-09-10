# 50k Elements Performance Improvement Plan

Status: in progress

## Goal

Make projects containing 50,000 elements responsive without weakening Maply's use of Effect or
changing the public `Editor` interface unnecessarily.

The primary target is the normal editing case where a 50,000-element document has hundreds of
elements visible in the viewport. The all-elements-visible case is a separate benchmark gate that
decides whether SVG culling is sufficient or a Canvas2D renderer is required.

## Non-negotiable constraints

- Effect continues to own command composition, typed failures, sequencing, transactions,
  cancellation, persistence coordination, tracing, and resource lifetime.
- Continuous pointer interaction applies at most one document mutation and publishes at most one
  consolidated change per animation frame. Pointer-up synchronously flushes the final position
  before committing the interaction.
- The public `Editor` interface remains stable while the implementation changes behind its seam.
- `@maply/model` remains pure, `@maply/storage` owns persistence mechanics, `editor/` owns editing
  workflows and live state, and `src/` owns browser events and rendering.
- Project import/export and SVG export remain compatible with existing project data.
- Accessibility, selection, hover, crop, text layout, layer ordering, and undo behavior must not
  regress.
- Generated files under `src/lib/components/ui/` must not be modified.
- No document-sized clone, serialization, validation pass, or scan may occur during a single-element
  pointer interaction.

## Performance gates

All measurements must use a documented browser, hardware profile, production build, fixture seed,
viewport, and zoom level. Record medians and p95 values; do not report only the fastest run.

| Scenario | Target |
| --- | --- |
| Drag or resize one element in a 50k document | p95 application and projection work at or below 8 ms per frame |
| Pan or zoom with at most 500 visible elements | p95 rendered frame at or below 16.7 ms |
| Hover across visible elements | No document revision, history entry, or autosave request |
| Sidebar scrolling | Bounded mounted row count; no long task caused by mounting 50k rows |
| Marquee selection | Query cost depends on spatial candidates, not all 50k elements per pointer sample |
| Undo one single-element edit | Cost and memory depend on the change size, not the document size |
| Autosave one single-element edit | Persist changed records only; no 50k-element structured clone |
| Zoom-to-fit with all 50k visible | Measured separately; result gates the Canvas2D milestone |

The first chunk may refine numeric thresholds when it establishes the reference environment. Any
change to a threshold must be recorded in this document with a reason; thresholds must not be
relaxed merely to make a regression pass.

## Verification fixtures

Use deterministic fixtures so results remain comparable:

- `1k-simple`: rectangles and circles used as a fast local smoke benchmark.
- `10k-mixed`: representative rectangles, circles, paths, and text.
- `50k-typical`: mixed elements distributed over a document with at most 500 visible at the reference
  viewport.
- `50k-all-visible`: predominantly simple shapes fitted into one viewport, plus a representative
  sample of paths and text.
- `50k-selection`: 50,000 elements with deterministic 1-, 100-, 1,000-, and all-element selections.

Image fixtures should reuse a small bounded asset set. The benchmark must measure element scaling,
not the cost of decoding 50,000 unrelated images.

## Target architecture

```text
browser input
    |
    v
frame coalescer (continuous input only)
    |
    v
Effect editor command
    |
    v
indexed document module ------> one typed DocumentChangeSet
                                  |        |         |
                                  v        v         v
                              renderer  history  persistence
                                  |
                                  v
                         narrow Svelte projections
```

The indexed document is a deep module. Callers must not know whether its implementation uses a
mutable `Map`, a persistent collection, an R-tree, or another optimized structure. Its interface
owns lookup, ordered iteration, mutation, queries, snapshots at explicit cold boundaries, and
precise change publication.

## Chunk overview

Each chunk is intended to be a separate pull request or independently reviewable commit series.
Do not begin a dependent chunk until the preceding exit criteria pass.

| Chunk | Deliverable | Depends on | Status |
| --- | --- | --- | --- |
| 0 | Reproducible benchmark and profiling harness | None | In progress |
| 1 | Transient interaction state separated from document state | 0 | Not started |
| 2 | Indexed document module and typed change sets | 1 | Not started |
| 3 | Frame-coalesced commands and narrow UI projections | 2 | Not started |
| 4 | Virtualized elements sidebar | 2 | Not started |
| 5 | Spatial index, hit testing, and viewport-culled SVG | 2, 3 | Not started |
| 6 | Incremental derived indexes and layout caches | 2, 5 | Not started |
| 7 | Change-based history | 2, 3 | Not started |
| 8 | Incremental Effect-based persistence | 2, 7 | Not started |
| 9 | Renderer decision and optional Canvas2D scene | 0-8 | Not started |
| 10 | Release hardening and 50k acceptance run | 0-9 | Not started |

## Chunk 0: Benchmark and profiling harness

### Scope

- Add deterministic fixture generation for all fixture sizes listed above.
- Add browser benchmarks for load, pan, zoom, hover, drag, resize, marquee, sidebar scroll, search,
  select-all, undo, redo, autosave, and zoom-to-fit.
- Record main-thread time, frame duration, long tasks, mounted DOM/SVG nodes, heap growth, and
  persisted bytes where the browser exposes them reliably.
- Add lightweight counters for document revisions, change publications, history records, and save
  requests.
- Capture the current baseline before making performance changes.

### Verification

- Running the documented benchmark command generates the same fixtures from the same seed.
- Results identify browser version, build mode, hardware, fixture, viewport, and zoom.
- The harness fails when the per-frame mutation/publication invariant is violated.
- Existing behavior tests remain green.

### Exit criteria

- Baseline results for every fixture and scenario are recorded under the evidence log.
- A reviewer can reproduce at least the `1k-simple` and `50k-typical` runs from a clean checkout.

## Chunk 1: Separate transient interaction state

### Scope

- Remove selection, hover, and crop-editing state from the persistent document store.
- Give document state and interaction state independent revision and subscription paths.
- Keep existing `Editor.selection` commands and caller-visible behavior stable.
- Ensure transient changes do not trigger document history or persistence.
- Avoid introducing one Svelte store per document element.

### Verification

- Hovering 1,000 elements changes only the hover projection.
- Selection changes do not replace the element collection.
- Hover, selection, and crop state do not create history entries or queue autosave.
- Selection, crop, context-menu, keyboard, and pointer behavior tests pass.

### Exit criteria

- Counters prove zero document revisions and zero save requests during hover-only activity.
- The baseline benchmark shows the effect of this chunk independently.

## Chunk 2: Indexed document module and typed changes

### Scope

- Introduce an editor-owned indexed document module behind the existing `Editor` seam.
- Maintain element lookup by ID separately from layer order.
- Represent selection membership with a set-like structure internally.
- Route add, delete, update, rename, move, resize, visibility, lock, bindability, and reorder commands
  through the module.
- Emit one typed `DocumentChangeSet` per atomic command. It must contain enough before/after and order
  information for rendering, history, indexes, and persistence without rescanning the document.
- Preserve element and layer-order invariants inside the module rather than in callers.
- Provide full ordered snapshots only at explicit cold boundaries such as export and initial load.

### Verification

- Single-element lookup and replacement do not scan or recreate the complete ordered collection.
- Bulk commands scale with the number of affected elements plus unavoidable order work.
- No caller mutates or receives the module's internal maps, sets, or indexes.
- Change-set contract tests cover every mutation tag and verify before/after correctness.
- Existing `Editor` compatibility tests pass unchanged where possible.

### Exit criteria

- The 50k single-element mutation benchmark meets the application-work budget before rendering.
- A change-set replay test produces the same document as direct command execution.

## Chunk 3: Frame coalescing and narrow projections

### Scope

- Coalesce continuous pointer samples at the browser interaction adapter using
  `requestAnimationFrame`.
- Execute one synchronous Effect command for the latest accumulated movement per frame.
- Flush the final accumulated movement synchronously before pointer-up commits history.
- Publish consolidated document changes to narrow Svelte projections rather than publishing the
  complete project for every transient or element-local change.
- Keep discrete commands such as keyboard movement, delete, undo, and property edits immediate.
- Prevent asynchronous fiber fan-out on the pointer hot path.

### Verification

- Automated interaction tests submit multiple pointer samples within one frame and observe one
  mutation and one published change.
- Pointer-up between scheduled frames preserves the final pointer position.
- Cancel restores the transaction start state exactly.
- UI consumers unrelated to the changed projection do not rerun.

### Exit criteria

- The one-mutation/one-publication-per-frame invariant is enforced by a test and benchmark counter.
- Drag and resize remain behaviorally equivalent to the current editor.

## Chunk 4: Virtualize the elements sidebar

### Scope

- Render only the visible row window plus a small overscan region.
- Preserve logical layer indexes independently of rendered row indexes.
- Make drag reorder, auto-scroll, filtered results, inline rename, context menus, and multi-selection
  work across virtual windows.
- Preserve keyboard focus and expose correct list size and position semantics to assistive
  technology.
- Keep selected and actively edited rows mounted or deliberately transfer focus when they leave the
  window.

### Verification

- Mounted row count remains bounded while scrolling `50k-typical`.
- Reordering at the start, middle, end, and across the virtual window produces the correct layer
  order.
- Search and type filtering return the same logical results as before.
- Keyboard navigation and focus survive scrolling and filtering.

### Exit criteria

- Sidebar scrolling passes its frame and long-task budgets with 50,000 rows.
- Accessibility checks cover row count, position, selection, and active editing.

## Chunk 5: Spatial index and viewport-culled SVG

### Scope

- Add a spatial-index interface owned by the indexed document implementation.
- Evaluate a uniform grid and an R-tree using representative element sizes; select using benchmark
  evidence and record the result.
- Update index entries from document changes rather than rebuilding after ordinary mutations.
- Query viewport candidates with overscan, then restore exact layer order before rendering.
- Use the same index for point picking and marquee candidate queries.
- Keep selected or actively edited elements available to interaction overlays when necessary.
- Replace per-element pointer enter/leave dependencies with index-backed picking where culling makes
  DOM event targets insufficient.

### Verification

- Index query results match a brute-force oracle across generated documents and mutations.
- Move, resize, delete, undo, and redo update index membership correctly.
- Panning does not produce visible pop-in inside the defined overscan region.
- Overlapping-element picking respects visibility, locking policy, and layer order.
- Marquee results match existing selection semantics.

### Exit criteria

- `50k-typical` renders only the spatial result plus overscan.
- Pan, zoom, hover, and marquee meet their performance gates with culled SVG.
- The `50k-all-visible` result is recorded without treating an expected SVG failure as a failure of
  this chunk.

## Chunk 6: Incremental derived indexes and layout caches

### Scope

- Maintain name counts, validation results, referenced-asset IDs, and minimum-canvas information from
  document changes.
- Cache element bounds and text layout using the fields that affect each calculation as cache keys.
- Invalidate only affected cache entries.
- Make selected-element projections use indexed lookup rather than document scans.
- Keep full validation and geometry scans as test or repair oracles, not interaction paths.

### Verification

- Incremental results match full recomputation across randomized command sequences.
- Renaming one element revalidates only names whose duplicate status can change.
- Geometry changes invalidate the element's bounds, spatial entry, and relevant text/image layout,
  but unrelated property changes do not.
- Cache memory is bounded and cleared on project replacement.

### Exit criteria

- No name-validation, selected-element, asset-reference, or bounds full scan occurs during a
  single-element interaction.

## Chunk 7: Change-based history

### Scope

- Replace complete document snapshots with inverse changes or reversible editor commands.
- Preserve transaction semantics: a drag containing many frame updates creates one undo entry.
- Define memory accounting or limits by stored change size, not only entry count.
- Keep image-asset deletion and rollback behavior coordinated through Effect.
- Retain a full snapshot only where required for project replacement or recovery, outside the hot
  interaction path.

### Verification

- Every document command has undo/redo round-trip tests.
- Undo followed by redo restores exact document content and order.
- Failed persistence during history movement preserves the documented rollback behavior.
- A one-element edit in a 50k document stores data proportional to one changed element.

### Exit criteria

- The history memory benchmark no longer grows by one document payload per edit.
- Existing history tests and new 50k history benchmarks pass.

## Chunk 8: Incremental Effect-based persistence

### Scope

- Introduce a versioned IndexedDB representation that stores document metadata, order, and element
  records without rewriting the entire project for one-element changes.
- Batch and debounce document changes through an Effect workflow.
- Periodically compact accumulated changes into a consistent persisted state.
- Make schema migration, transaction failure, retry, shutdown flush, and project replacement explicit
  Effect workflows with typed failures.
- Preserve current project import/export formats even if the live persistence representation changes.
- Keep storage types and IndexedDB mechanics inside `@maply/storage`.

### Verification

- Migration tests load existing stored projects and preserve every field.
- Crash/reload tests cover batches before, during, and after compaction.
- A single-element save writes only changed records and required metadata.
- Shutdown flush persists the latest committed change exactly once.
- Import, export, reset, undo, and asset replacement remain atomic from the user's perspective.

### Exit criteria

- Autosave of one changed element has work and payload independent of total element count, excluding
  deliberate compaction.
- Compaction does not block continuous interaction beyond the performance budget.

## Chunk 9: Renderer decision and optional Canvas2D scene

### Decision gate

First rerun every benchmark using the indexed engine, virtualization, caches, and culled SVG.

- If both `50k-typical` and the agreed all-visible experience meet their budgets, retain SVG and
  document the decision.
- If the all-visible or high-density cases miss their budgets, implement the hybrid renderer below.

### Hybrid-renderer scope

- Draw ordinary scene elements through Canvas2D.
- Keep SVG or HTML overlays only for active selection, hover, handles, path vertices, drafts, and crop
  controls.
- Use spatial picking for pointer routing and hover instead of per-element DOM events.
- Reuse cached bounds and text layout; verify Canvas text baselines, wrapping, and alignment against
  current SVG behavior.
- Redraw on animation frames only when camera state or relevant document changes invalidate the
  scene.
- Provide accessibility through the virtualized logical element list and active-selection controls;
  do not create a hidden 50,000-node SVG mirror.
- Keep SVG export as a model projection, independent of the interactive renderer.

### Verification

- Screenshot or pixel-difference tests cover every element type, zoom ranges, crop, selection,
  opacity/stroke behavior, and light/dark UI integration.
- Interaction tests cover topmost picking, hover transitions, drag, resize, path editing, text, image
  crop, and cursor behavior.
- Canvas and SVG representations agree on bounds used for hit testing and overlays.
- Renderer DOM size remains bounded independently of document size.

### Exit criteria

- The benchmark evidence states whether SVG or Canvas2D is the selected renderer and why.
- Both typical and all-visible 50k scenarios meet the agreed experience targets, or the remaining
  limitation is explicitly documented for the next decision gate.

## Chunk 10: Optional worker/GPU decision and release hardening

### Scope

- Consider OffscreenCanvas only if main-thread rendering remains the measured bottleneck after the
  Canvas2D milestone.
- Consider WebGL only if Canvas2D misses the agreed all-visible target after culling, cache reuse,
  style batching, and low-zoom simplification are measured.
- Add production telemetry for slow commands, slow frames, spatial candidate counts, rendered
  element counts, save batch size, and typed failure tags without recording sensitive document
  contents.
- Run compatibility, accessibility, memory, import/export, persistence migration, and soak tests.
- Remove temporary dual implementations and benchmark-only instrumentation that is not useful in
  production.

### Verification

- A renderer change is justified by recorded evidence, not preference.
- A 30-minute edit/undo/save soak test shows bounded heap and cache growth.
- Production build, dependency validation, type checks, and all test suites pass.
- The final acceptance matrix is completed below.

### Exit criteria

- Every non-negotiable constraint and required scenario has linked evidence.
- Known limitations have an owner and a follow-up issue; no performance fallback silently changes
  editing semantics.

## Cross-cutting verification rules

Apply these rules to every chunk:

1. Record baseline and after-change measurements using the same fixture and environment.
2. Test observable behavior through the public module seam; do not use module mocks.
3. Add brute-force reference implementations for indexes and incremental projections where useful,
   then compare optimized results against them in generated tests.
4. Keep performance instrumentation out of tight loops unless the benchmark measures its overhead.
5. Treat unexpected cache/index disagreement as a defect; do not silently fall back during ordinary
   interaction.
6. Run the smallest relevant suite during development and the complete repository checks before the
   chunk is marked complete.
7. Update this document in the same change that completes a chunk.

## Evidence log

Add one row when a chunk is completed. Link the pull request or commit, benchmark artifact, and test
output. Put detailed benchmark files in a dedicated benchmark-results directory rather than pasting
large traces into this document.

| Chunk | Commit/PR | Before | After | Verification | Decision or notes |
| --- | --- | --- | --- | --- | --- |
| 0 | — | — | — | — | Not started |
| 1 | — | — | — | — | Not started |
| 2 | — | — | — | — | Not started |
| 3 | — | — | — | — | Not started |
| 4 | — | — | — | — | Not started |
| 5 | — | — | — | — | Not started |
| 6 | — | — | — | — | Not started |
| 7 | — | — | — | — | Not started |
| 8 | — | — | — | — | Not started |
| 9 | — | — | — | — | Not started |
| 10 | — | — | — | — | Not started |

## Final acceptance matrix

Complete this table during Chunk 10.

| Capability | 1k | 10k | 50k typical | 50k all visible | Evidence |
| --- | --- | --- | --- | --- | --- |
| Load | — | — | — | — | — |
| Pan/zoom | — | — | — | — | — |
| Hover/pick | — | — | — | — | — |
| Drag/resize | — | — | — | — | — |
| Marquee | — | — | — | — | — |
| Sidebar scroll/search | — | — | — | — | — |
| Select all/bulk edit | — | — | — | — | — |
| Undo/redo | — | — | — | — | — |
| Autosave/reload | — | — | — | — | — |
| Import/export | — | — | — | — | — |
| Accessibility | — | — | — | — | — |
| Memory/soak | — | — | — | — | — |

## How to update this plan

When work begins on a chunk:

1. Change its overview status to `In progress`.
2. Record the baseline artifact before implementation.
3. Keep changes inside the chunk's scope. If a prerequisite is discovered, amend this plan before
   broadening the implementation.
4. Record test and benchmark evidence.
5. Mark the chunk `Complete` only after all exit criteria pass.
6. Record architectural decisions—especially spatial-index and renderer choices—in the evidence log
   and an ADR when they introduce a lasting seam or shared pattern.
