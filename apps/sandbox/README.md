# ShiftCharts Sandbox

The sandbox is an isolated local app for shaping ShiftCharts chart design. It does not share route
state with the existing demo app and does not modify package or theme source files.

```bash
pnpm --filter @shiftcharts/sandbox dev
```

Open <http://localhost:5176>.

## What it controls

- all ten registered chart types and sample data;
- preview width, height, title, and the four shipped themes;
- value display, labels, legend, gridline, and table `PlanOverrides`;
- every scalar `PlanPolicy` field, horizon bands, mark substitution, and facet columns;
- the complete policy and override JSON editors;
- every exported `--shiftcharts-*` CSS custom property, scoped to the sandbox root;
- copyable config, plan, and CSS output for a later core or theme change.

The preview resolves `planChart()` and renders the resulting `ChartPlan` with the real
`@shiftcharts/primitives` `<Chart>`. The existing demo app remains the product showcase, measurement
lab, and browser-fixture surface.
