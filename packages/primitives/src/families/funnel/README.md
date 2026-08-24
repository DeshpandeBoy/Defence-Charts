# Funnel primitive renderer

This family consumes the coordinator-owned `SeriesFrame.funnel` seam and the explicit
`MarkSpec['funnel']` mark. It is hook-free, has no DOM or browser dependency, and is safe for the
static/RSC render path.

The renderer does not sort stages, read `Series[]`, calculate conversion or drop-off, choose a
minimum bar size, or derive rectangle geometry. The shared frame must provide canonical ordered
stage IDs, labels, values, ratios, and finite `x`/`y`/`width`/`height` values. Zero-sized stage
geometry is accepted so a zero-valued stage remains present in text and table semantics.

The explicit mark detail selects the information shown in the SVG:

- `summary` shows the frame-provided overall conversion.
- `stages` shows each frame-provided stage rectangle, label, and absolute value.
- `dropoff` adds the frame-provided per-stage relative drop-off.
- `breakdown` adds frame-provided share, relative conversion, and drop-off.

Every stage is keyed by its supplied ID and emits `data-funnel-stage-id`, `data-stage-id`, label,
value, share, conversion, and drop-off attributes. The numeric values are also visible in text;
`null` conversion/drop-off is written as `unavailable` rather than being fabricated or encoded by
colour. Ratios are formatted as percentages only for presentation; the renderer never derives
them.

Malformed plans, missing frame geometry, duplicate IDs, negative values, non-finite values, and
negative rectangle sizes fail explicitly. Canvas output is an explicit future boundary and does
not rasterize or fall back to a bar/line renderer.

Coordinator registration request:

- register `FUNNEL_MARK_RENDERERS` in the central primitive renderer registry;
- keep `FunnelFrame`/`FunnelStageFrame` serialisable and populate them in `resolveFrame()` for the
  explicit funnel mark;
- keep one ordered non-empty series as the funnel data contract and reject negative/duplicate
  stages in core;
- keep the shared `DataTable` funnel variant as the non-colour accessible equivalent and preserve
  summary/value semantics at the Tile rung;
- add the funnel family to the shared matrix and central exports without changing this directory.
