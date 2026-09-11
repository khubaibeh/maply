# Browser benchmarks

The benchmark lab measures the editor in a documented production browser. It uses seeded fixtures,
retains every application and animation-frame sample, and reports medians and p95 values from those
individual samples.

## Generate fixtures

```sh
pnpm benchmark:fixtures
```

This writes `benchmark-results/fixtures.json` and runs the deterministic indexed-engine gates,
which write `benchmark-results/indexed-mutation.json`, `benchmark-results/indexed-soak.json`, and
`benchmark-results/renderer-decision.json`. The fixture generator does not write the 50k-element
projects to source control. The manifest records each seed, count, viewport, selection sizes, and
content fingerprint.

## Run the browser suite

1. Generate the fixtures and build the app with `pnpm benchmark:fixtures` and `pnpm build`.
2. Serve the production build with `pnpm preview --host 127.0.0.1`.
3. Open `/benchmark` in the documented browser and hardware profile.
4. Select **baseline** on the first checkout and **after** on the changed checkout. Run both
   `50k-typical` and `50k-all-visible` in each checkout, then save each raw report under
   `benchmark-results/` with the checkout label, browser, and hardware in its filename.
5. On the changed checkout, run **Run 30-minute soak** for both 50k fixtures and save the raw soak
   reports. The soak performs repeated edit, undo, redo, and save operations and records timestamped
   heap, mounted-node, rendered-element, path-cache, and image-cache observations.

The page measures load, pan, zoom, hover, drag, resize, marquee, sidebar scroll, search, select-all,
undo, redo, autosave, and zoom-to-fit. It also records per-sample application and frame times, whole
scenario duration for context, long tasks, mounted nodes, SVG nodes, selected renderer, spatial
candidates, rendered elements, bounded path/image cache sizes, heap growth when available,
serialized persistence payload size, document revisions, change publications, history records, and
save requests. Multi-frame scenarios expose all frame samples in the raw report; summary p95 values
are never calculated from the total duration of a 30- or 60-frame scenario.

Run the suite in a production build. Record the browser user agent, hardware, fixture fingerprint,
viewport, and zoom from the report. Do not compare reports made with different fixture or environment
metadata. A browser that does not expose `performance.memory` must leave heap values null; it is not
valid to substitute a Node heap measurement for the browser soak gate.

## Run browser interaction tests

`pnpm test:browser` runs the focused Canvas interaction tests in Vitest's Playwright Chromium
provider. The tests cover shape-accurate overlap picking and path vertex insertion through the
browser SVG overlay. The host must provide a runnable Chromium installation. On supported hosts,
provision the browser and its Linux dependencies with:

```sh
pnpm exec playwright install --with-deps chromium
```
