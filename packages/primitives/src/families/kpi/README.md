# KPI primitive contract

KPI is a composition, not a new SVG mark. The value region is rendered by the existing
`ValueDisplay`, the optional trend is the existing `line` mark with axes suppressed, and the
accessible text equivalent is the existing `DataTable`. There is no KPI renderer registry entry
and no `sparkline` chart type or mark to add here.

`fixture.ts` is the deterministic post-frame contract used by the family-local test. It keeps the
metric qualifiers separate from the formatted value so the hook-free output can preserve their
meaning without relying on color:

- `unit`: `USD`
- `target`: `60`
- `status`: visible `positive` text
- `delta`: `+4`, direction `up`
- `comparison`: previous value `54`

The coordinator's shared integration must make those fields visible through the existing
`ValueDisplay` and `DataTable` composition. This family-local slice intentionally does not edit
either shared component; it only supplies the canonical input and asserts the composition contract.
