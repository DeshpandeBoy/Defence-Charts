# ShiftCharts Sandbox

The sandbox is an isolated local app for shaping ShiftCharts chart design and client interactions.
It does not share route state with the existing demo app and does not modify package or theme
source files.

```bash
pnpm --filter @shiftcharts/sandbox dev
```

Open <http://localhost:5176>.

## What it controls

- all ten registered chart types and sample data;
- preview width, height, title, and the four shipped themes;
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

The existing demo app remains the product showcase and browser-fixture surface.
