# raw-demo

A plain, bundler-free consumption test for ShiftCharts. `apps/sandbox` is the engineering
workbench (every policy field, token catalogue, JSON editors, all ten chart families). This app
answers a narrower question: *if a real consumer just imports `@shiftcharts/react` and drops a
box on the page, what do they actually get?*

## What it is

- `src/entry.tsx` — a small React 19 app: a showcase grid of `<AutoChart>` cards at realistic
  widget sizes (Tile/Strip/Panel/Canvas) with `DEFAULT_POLICY` and no overrides, plus a live
  tweak console covering the policy fields with the most visible effect on layout.
- `build.mjs` — bundles `entry.tsx` with esbuild (no external CDN, fully self-contained) and
  copies the packages' own CSS files (`theme.css`, `chart.css`, `auto-chart.css`,
  `interaction-overlay.css`) into `dist/styles/`.
- `index.html` — genuinely plain HTML: `<link>` tags for the copied CSS, one `<script
  type="module" src="./dist/entry.js">`, no build step visible to the page itself.

## Run it

```bash
node apps/raw-demo/build.mjs
npx serve apps/raw-demo   # or: python3 -m http.server --directory apps/raw-demo
```

Then open the printed URL. There is no watch mode — re-run `build.mjs` after a source change and
reload the page.

## Debugging and tweaking from here

- **Tokens (colour, spacing, radii, typography)** — every visual property in `chart.css` is a
  `var(--shiftcharts-*)` custom property declared in `theme.css`. Select the `<svg>` in devtools
  and edit the custom property on `:root` in the Styles pane; no rebuild needed.
- **Geometry (plot box, tick counts, label degradation, legend bands)** — the tweak console's
  sliders write straight into `PlanPolicy`/`PlanOverrides`, the same two inputs `planChart()`
  takes anywhere in the library (see `packages/core/src/policy.ts`). The "Resolved ChartPlan
  JSON" panel shows exactly what the resolver decided for the current box and policy.
- **Size-class ladder** — resize the browser (or use the devtools device toolbar) across the
  showcase cards to sweep `micro → tile → strip → panel → canvas → stage` live;
  `packages/core/src/context.ts` documents the px thresholds each boundary is anchored to.
- **Full policy/token surface** — `apps/sandbox` (`pnpm --filter @shiftcharts/sandbox dev`)
  exposes every `PlanPolicy` field, the full token catalogue with search, and raw data/plan JSON
  editors per chart family.
