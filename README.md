# ShiftCharts

**Charts that shift with their space.**

ShiftCharts is an open-source React chart and dashboard-grid library whose responsive planner changes
the information a chart presents as its container changes. The same serialisable plan renders through
a hook-free React Server Component path or an adaptive client boundary.

## Packages

- `@shiftcharts/core` — pure planning, geometry, interaction, typography, and layout contracts.
- `@shiftcharts/primitives` — hook-free, RSC-safe SVG rendering.
- `@shiftcharts/react` — measured responsive charts and client interaction.
- `@shiftcharts/grid` — controlled 12-column dashboard grid and widget shell.
- `@shiftcharts/tokens` — CSS custom-property themes and typed token names.
- `@shiftcharts/testing` — deterministic ResizeObserver and semantic-output helpers.

The Free-v1 chart catalogue covers line, area, bar/timebar, donut, KPI, progress, scatter, heatmap,
and funnel, with shared accessibility, responsive, theme, browser, RSC, and packed-consumer gates.

## Development

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm verify
```

Node.js 22.18 or newer is required. See [`docs/`](docs/) for the documentation application and
[`research/90-final-delivery-and-agent-plan.md`](research/90-final-delivery-and-agent-plan.md) for the
verified delivery ledger.

## License

MIT. See [`LICENSE`](LICENSE).
