# Browser benchmarks

The benchmark lab measures the current editor before performance work changes it. It uses seeded
fixtures, records raw samples, and reports medians and p95 values.

## Generate fixtures

```sh
pnpm benchmark:fixtures
```

This writes `benchmark-results/fixtures.json`. The fixture generator does not write the 50k-element
projects to source control. The manifest records each seed, count, viewport, selection sizes, and
content fingerprint.

## Run the browser suite

1. Generate the fixtures and build the app with `pnpm benchmark:fixtures` and `pnpm build`.
2. Serve the production build with `pnpm preview --host 127.0.0.1`.
3. Open `/benchmark` in the documented browser and hardware profile.
4. Select each fixture and use **Run baseline**. Save the raw JSON from the report under
   `benchmark-results/`.

The page measures load, pan, zoom, hover, drag, resize, marquee, sidebar scroll, search, select-all,
undo, redo, autosave, and zoom-to-fit. It also records application time, frame time, long tasks,
mounted nodes, SVG nodes, heap growth when available, serialized persistence payload size, document
revisions, change publications, history records, and save requests.

Run the suite in a production build. Record the browser user agent, hardware, fixture fingerprint,
viewport, and zoom from the report. Do not compare reports made with different fixture or environment
metadata.
