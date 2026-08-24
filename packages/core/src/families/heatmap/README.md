# Heatmap family

The heatmap planner is a pure, serialisable activity-grid contract. It uses the shared
`MarkSpec` cell seam (`{ kind: 'cell', bandStart: 0, bandEnd: 1 }`) and keeps all value-aware
geometry in the coordinator-owned frame. The planner never samples, drops, sorts, merges, or
coerces data values.

## Responsive information states

| Size | Plan state |
| --- | --- |
| Micro | No readable grid; replace it with a total value and summary table semantics. |
| Tile | Replace the grid with a total value; no cell mark is emitted. |
| Strip | Recent/last-N-weeks window, no axis labels, tap-to-reveal values, and a full table path. |
| Panel | Full-range cell grid with weekday and month axis intent. |
| Canvas | Full range plus an external intensity legend and spelled weekday labels. |
| Stage | Canvas semantics plus per-cell hover values and visible streak-annotation intent. |

The size-specific state is explicit in the local `heatmap` plan block. The shared `interaction`
and `dataTable` fields remain authoritative for tooltip and non-colour access semantics. The
compact rungs use widget-level keyboard/tap semantics; Strip and larger rungs expose cell-level
keyboard semantics with table text. Stage adds hover text to that static table path.

## Density and identity

`marks.pointBudget` and `heatmap.cellBudget` are the explicit rendering budget. Crossing it selects
`marks.renderer: 'canvas'`; it never silently samples cells. The default nominal cell floor is 8px,
labelled project-owned Tier C (`nominalCellFloorTier: 'C'`). When a populated temporal grid cannot
maintain that floor, `aggregate.temporalBin` becomes `'weekly'` rather than shrinking the cell.

The planner only receives `DataShape`, so duplicate/unsorted x values and missing-cell identity
are not resolved here. The frame must canonicalise numeric/date x values, reject duplicate x
values within a series, preserve `null` as a missing cell, and key cells as `${series.id}:${x}`.
The configured recent-week window is likewise frame/host-owned; the planner records its state as
`range: 'recent-weeks'` without inventing an N.

Central integration requested from the coordinator:

- register `HEATMAP_CHART_TYPES` and `heatmapFamilyPlanner` in `planner-registry.ts`;
- promote the local `HeatmapSemantics` block or an equivalent central plan seam;
- complete frame cell geometry/identity, recent-window handling, intensity normalisation, and
  table/keyboard text without editing this family planner;
- register the cell renderer and extend the shared family matrix.

The 8px floor is an implementation policy, not a perception citation. It must remain labelled
Tier C in public documentation until new evidence promotes it.
