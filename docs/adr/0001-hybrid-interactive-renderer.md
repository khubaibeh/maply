# ADR 0001: Use a hybrid interactive renderer for dense scenes

Status: accepted

## Context

Maply keeps layer order, spatial picking, export, and accessibility semantics in the editor/model
seams. A 50,000-element scene is still an unusually large DOM projection when most of those
elements are inside one viewport. Replacing the SVG scene wholesale would lose the existing
selection, resize, crop, path-editing, and keyboard seams.

## Decision

Use the indexed document's spatial query to choose the interactive renderer per viewport:

- SVG remains the renderer when 2,000 or fewer candidates are visible. It preserves the existing
  per-element interaction surface and the culled, overscanned scene.
- Canvas2D paints ordinary dense scene elements when more than 2,000 candidates are visible.
- A small SVG overlay retains the artboard controls, active selection, hover outline, resize and
  path handles, crop controls, marquee, and drawing drafts.
- Pointer picking always comes from the indexed spatial query, so Canvas2D does not need a hidden
  duplicate SVG tree.
- The model-driven SVG exporter remains independent of this choice.

The threshold is a named decision gate in `chooseCanvasRenderer`; it can be changed with a new
benchmark artifact rather than a renderer preference.

## Consequences

Canvas2D uses the existing model geometry and text-layout functions, with bounded path and image
caches. The logical elements sidebar remains the accessibility representation. OffscreenCanvas and
WebGL are deferred until production telemetry shows that Canvas2D paint time, rather than document
projection or picking, is the remaining bottleneck.
