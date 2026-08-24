# Progress family

The progress family is a target-aware completion composition with an explicit responsive
encoding substitution. Micro and Tile use a radial progress mark; Strip, Panel, Canvas, and
Stage use a horizontal progress mark. The planner never returns a KPI, donut, line, or bar mark.

The planner is data-blind by the shared `planChart()` contract. The value-aware frame consumes the
latest finite point for current and accepts only a finite, strictly positive target for determinate
geometry. Missing or non-finite current values, and missing, zero, negative, or non-finite targets,
remain explicit indeterminate states. Finite negative current values remain data (their completion
ratio is clamped to zero); they are not silently converted to positive progress.

The shared frame/renderer integration owns ratio clamping, remaining and over-target values, stable
series identity, radial paths, horizontal track/fill rectangles, and visible current/target/status
text. This family-local package owns only the pure six-rung plan and its contract fixtures.

Central integration remains coordinator-owned: register `PROGRESS_CHART_TYPES` and
`progressFamilyPlanner`, then connect the progress frame/renderer and family matrix without
changing this family-local contract.
