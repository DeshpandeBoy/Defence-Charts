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

## Interaction performance

UX-PERF-01 compares a captured pre-optimization Chromium run with the current interaction path.
The deterministic merge signal is geometry work; elapsed time is included for context only and is
not a universal FPS claim.

| Signal (24 pointer samples) | Before | Current | Change |
|---|---:|---:|---:|
| SVG `getBoundingClientRect()` reads | 24 | 1 | **95.8% fewer** |
| Mean event-to-next-frame time | 8.6375 ms | 8.6083 ms | 0.34% lower (machine-dependent) |
| Distinct resolved datums | 23 | 23 | preserved |
| Runtime errors | 0 | 0 | preserved |

The current path also uses a prepared line/time-series X index, one latest pointer sample per
`requestAnimationFrame`, and a retained crosshair node. Scatter remains exhaustive XY by policy;
its 1,900-point baseline is recorded in
[`scripts/results/ux-perf-01-scatter-interaction.latest.json`](scripts/results/ux-perf-01-scatter-interaction.latest.json).

Re-run the comparison and gates with:

```bash
node scripts/compare-interaction-performance.mjs
pnpm exec vitest run packages/react/src/InteractionOverlay.test.tsx packages/react/src/interaction-index.test.ts packages/react/src/interaction-scheduler.test.ts packages/react/src/interaction-policy.test.ts --reporter=dot
pnpm typecheck
node scripts/check-interaction-performance.mjs
node scripts/check-scatter-interaction-performance.mjs
node scripts/check-interaction-browser.mjs
```

The comparator passes only when geometry reads decrease to one or fewer and the latest browser run
has no runtime errors. Timing should be evaluated over repeated runs before making an FPS claim.

## License

MIT. See [`LICENSE`](LICENSE).
