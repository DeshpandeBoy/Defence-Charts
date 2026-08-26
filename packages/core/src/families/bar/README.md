# Bar and timebar family

This family owns the pure `bar`/`timebar` ladder and the grouped-by-default bar decision. Its
renderer consumes `SeriesFrame.cells` and never falls back to line geometry.

The shared frame populates `cells` when the plan's primary mark is `bar`; the renderer consumes
that central geometry seam without changing the family-local planning contract.
