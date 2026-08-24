# Bar and timebar family

This family owns the pure `bar`/`timebar` ladder and the grouped-by-default bar decision. Its
renderer consumes `SeriesFrame.cells` and never falls back to line geometry.

The current shared frame contract does not yet populate `cells` when the plan's primary mark is
`bar`; that central frame/registry/export integration is coordinator-owned and is intentionally
recorded in the D1.1 handoff rather than changed from this family-local checkpoint.
