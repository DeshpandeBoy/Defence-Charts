# ShiftCharts Sandbox

The sandbox is an isolated local app for shaping ShiftCharts chart design and client interactions.
It does not share route state with the existing demo app and does not modify package or theme
source files.

```bash
pnpm --filter @shiftcharts/sandbox dev
```

Open <http://localhost:5176>.

Each registered family has a geometry-first page:

- `/charts/line`
- `/charts/area`
- `/charts/bar`
- `/charts/timebar`
- `/charts/scatter`
- `/charts/donut`
- `/charts/kpi`
- `/charts/progress`
- `/charts/heatmap`
- `/charts/funnel`
- `/performance`

The family navigation and chart-type selector load the matching valid sample. The geometry
inspector reports the measured content box, SVG viewBox, resolved plot box, and legend mode for
the current page. This pass intentionally studies standalone pixel geometry; React-grid widget
placement and cell constraints are deferred to a later integration pass.

## What it controls

- all ten registered chart types and sample data;
- preview width, height, title, and the four shipped themes;
- Core CSS and Cinematic motion modes for the chart preview, size ladder, and interaction examples;
- value display, labels, legend, gridline, and table `PlanOverrides`;
- interaction trigger, tooltip placement, tooltip visibility, crosshair, and active-point controls;
- a controlled five-series legend study using the shipped `LegendControl`;
- every scalar `PlanPolicy` field, horizon bands, mark substitution, and facet columns;
- the complete policy and override JSON editors;
- every exported `--shiftcharts-*` CSS custom property, scoped to the sandbox root;
- copyable config, plan, and CSS output for a later core or theme change.

The preview uses the measured `<AutoChart>` boundary from `@shiftcharts/react`. It resolves the
same `planChart()` from `@shiftcharts/core` against the actual available content box and renders
the same `@shiftcharts/primitives` `<Chart>`, so a constrained preview cannot clip a nominally wider
SVG. The implementation analysis is recorded in [`CHART-ANALYSIS.md`](./CHART-ANALYSIS.md).

The Performance page is the first recommendation workbench. It runs deterministic 1k, 2k, 10k,
30k/3-series, 50k, and 100k scatter cases in the browser and reports generation, shape, plan,
frame, interaction-index, nearest-`xy` lookup, and serialised payload timings. It also shows the
complete JSON for all ten shipped family samples. Dense scatter cases are measured without mounting
the current Canvas-bound visual renderer, so the page exposes the existing boundary instead of
silently treating it as complete.

The existing demo app remains the product showcase and browser-fixture surface.
