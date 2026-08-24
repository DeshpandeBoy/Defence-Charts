# Heatmap primitive renderer

This family-local renderer paints the rectangles supplied by the shared
`SeriesFrame.cells` seam. It is hook-free, has no DOM or browser dependency, and is safe to call
from the static/RSC render path.

The renderer deliberately does not derive cells from `points`, sample dense input, choose a
colour scale, or invent missing values. The coordinator-owned planner/frame decides the
responsive activity-heatmap contract, temporal binning, intensity semantics, and data-table
equivalent. Every supplied frame cell is validated and painted, including duplicate geometry and
zero-size finite geometry.

`CellFrame` always contains geometry (`x`, `y`, `width`, `height`) and may supply `id`, `value`, and
normalised `intensity` metadata. The renderer uses `cell.id ?? seriesId:cell:index` as the stable
identity, emits it as `data-heatmap-cell-id` (and the shared `data-cell-id` compatibility
attribute), spells a null value as `data-heatmap-state="missing"`, exposes finite values through
`data-heatmap-value`, and maps finite 0–1 intensity to a rounded 0–4
`data-heatmap-intensity` bucket. Geometry-only frames omit these metadata attributes and still
render normally.

Malformed or non-finite geometry throws. Negative width/height throws. Canvas and other renderer
modes throw rather than rasterizing, sampling, or falling back to a line/bar renderer.

Coordinator registration request:

- register `HEATMAP_MARK_RENDERERS` in the central primitive renderer registry;
- ensure the shared `resolveFrame()` populates `SeriesFrame.cells` for `MarkSpec['cell']` with
  finite geometry and preserves the frame's cell order/identity contract;
- provide the heatmap's text/data-table and non-colour semantics in the shared integration layer.
