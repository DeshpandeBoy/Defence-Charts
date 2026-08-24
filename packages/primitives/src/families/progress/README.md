# Progress primitive contract

The progress family consumes only the serialisable `SeriesFrame.progress` seam from `@gx/core`.
The coordinator owns the current/target calculation and the responsive planner; this family owns
the SVG geometry boundary:

- `horizontal` plans paint a track and, when a bounded ratio exists, a fill rectangle.
- `radial` plans paint a track and, when a bounded ratio exists, a fill path translated to the
  frame-provided centre.
- stable `data-progress-*` attributes expose series identity, orientation, state, and numeric
  semantics to tests, host tooling, and themes.
- indeterminate, missing-current, missing-target, and over-target states include visible text in
  the SVG. Their meaning does not depend on fill colour.

There is no hook, DOM measurement, data derivation, or fallback to a line, bar, or donut in this
directory. The coordinator must register `PROGRESS_MARK_RENDERERS`, populate `SeriesFrame.progress`,
and provide the shared value/table semantics for current, target, remaining, and over-target.
