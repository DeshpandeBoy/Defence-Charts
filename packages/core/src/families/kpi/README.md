# KPI family

The KPI planner is a composition of the existing value band and line-family semantics. It does
not add a `kpi` mark or a `sparkline` mark: Micro is value-only, Tile and Strip use the existing
measured line → horizon → none path with axes off, and Panel through Stage retain the full line
chart while adding the value region.

The planner is data-blind. Existing `Series` metadata carries the metric's unit, target, and
textual status; the frame/renderer integration must carry those fields into the visible value and
table output. `narrative.valueDisplay: 'latest+delta'` and `narrative.deltaBasis: true` are the
planner's explicit comparison contract. Delta direction is derived from the supplied points, not
invented by the planner.

Central integration remains coordinator-owned: register `KPI_CHART_TYPES` and
`kpiFamilyPlanner`, then add the shared value/frame/table and family-matrix proof without changing
this family-local contract.
