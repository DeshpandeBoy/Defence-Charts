# Funnel family

The funnel planner is a pure, serialisable information contract for one ordered series of
non-negative stage values. It uses the existing `Series`/`DataShape` boundary and never reads
raw values, touches the DOM, or computes pixel geometry.

## Responsive information states

| Size | Plan state |
| --- | --- |
| Micro | Replace the plot with an overall-conversion summary and summary-table semantics. |
| Tile | Keep the overall-conversion summary; the plot remains replaced. |
| Strip | Transpose to horizontal stage bars; stage labels and the full table remain available. |
| Panel | Use a vertical stage funnel with stage names and visible values. |
| Canvas | Add per-stage drop-off semantics and fluid stage interaction. |
| Stage | Add the overall summary, relative conversion, and per-stage breakdown semantics. |

`valueLegibility: 'shape-only'` is intentional for the plotted rungs: numeric values are made
explicit by the stage text/table seam, while the funnel silhouette does not claim an axis-based
estimate. The data table is present at every rung; Micro and Tile use the widget-level disclosure.

## Data contract and coordinator seams

The planner rejects negative shape flags, more than one series, and duplicate-stage evidence
(`points > categories` for one series). An empty shape is accepted so the host can render an
explicit empty state. The planner cannot see canonical x order, null values, non-finite values, or
the actual stage labels. The coordinator-owned frame must therefore:

- validate one series of finite, non-negative values when a populated funnel mark is resolved;
- sort by canonical numeric/date x, reject duplicate x values, preserve stable keys as
  `series.id + stage identity`, and keep null stages explicit rather than coercing them to zero;
- derive overall conversion from the first finite stage and per-stage drop-off from the previous
  positive stage, returning null/table-dash semantics for a zero baseline or unavailable input;
- produce finite serialisable stage rectangles and expose values, conversion, and drop-off as
  visible text/table semantics rather than relying on shape or colour.

No minimum stage width/height or stage-count threshold is presented as perception evidence. Any
such geometry default is project-owned Tier C until the missing funnel-specific research handoff
is completed.

Central integration remains coordinator-owned: verify the built-in planner registration, complete
the funnel frame/mark renderer, connect the funnel data-table/accessibility path, and add the shared
family matrix/browser proof. This family-local planner must not fall back to a line or bar plan when
funnel input is invalid.
