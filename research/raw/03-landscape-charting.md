# React charting library landscape

> workflow agent `a2450e1fdec18c97c` - 18,345 chars

---

## 2026 React charting landscape — evaluation for an MIT, presentational-only, granular-control chart library

All npm/GitHub figures pulled 2026-08-22. Gzip figures from bundlephobia API (standalone package incl. its deps). Type/prop details read directly from published `.d.ts` in the tarballs (`npm pack`), not from docs.

---

### 1. Hard data table

| Library | Latest | License | Render | gzip (measured) | deps | sideEffects | React 19 peer | npm/wk | Last commit |
|---|---|---|---|---|---|---|---|---|---|
| **visx** (`@visx/*`) | **4.0.0** (2026-06-11) | MIT (`@visx/vendor` = "MIT and ISC") | SVG | see §2 | per-pkg 0–6 | `false` (all) | `^18 \|\| ^19` | `@visx/shape` 5.03M | 2026-06-22 |
| **Recharts** | **3.10.1** (2026-07-25) | MIT | SVG | **125,523** (v3.2.1) | 11 | `false` | `^16.8‖17‖18‖19` | **58.56M** | 2026-08-22 |
| **Nivo** (`@nivo/line`) | 0.99.0 (2025-05-23) | MIT | SVG + Canvas | **92,384** | 12 | `true` | `^16.14‖17‖18‖19` | 1.63M (core) | 2026-07-21 |
| **Observable Plot** | 0.6.17 (2026-04-06) | ISC | SVG | **127,958** | 3 | `["./src/index.js"]` | n/a (no React dep) | 553k | 2026-07-13 |
| **uPlot** | 1.6.32 (2025-03-14) | MIT | **Canvas 2D** | **21,856** | **0** | `true` | n/a | 485k | 2026-04-22 |
| **ECharts** | **6.1.0** (2026-05-19) | **Apache-2.0** | Canvas + SVG (zrender) | **367,958** full | 2 | glob array | n/a | 5.00M | 2026-08-04 |
| `echarts-for-react` | 3.0.6 | MIT | — | 3,575 | 2 | `true` | `>=16` (peer allows echarts ^6) | 1.41M | 2026-05-19 |
| **Chart.js** | 4.5.1 (2025-10-13) | MIT | **Canvas 2D** | **68,404** | 1 | 4-path array | n/a | 12.63M | 2026-05-27 |
| `react-chartjs-2` | 5.3.1 | MIT | — | **1,027** | 0 | `false`, `"type":"module"` | `^19` ok | 4.42M | 2025-10-27 |
| **Tremor** (`@tremor/react`) | 3.18.7 (**2025-01-13**) | Apache-2.0 | SVG (via **Recharts ^2.13.3**) | **222,487** | 7 | `true` | — | 370k | repo 2025-10-10 |
| **shadcn/ui charts** | n/a — **copy-paste CLI, not npm** | MIT | SVG (Recharts **v3**) | = Recharts | — | — | yes | — | active |
| **Victory** | 37.3.6 (2026-07-20) | MIT (`LICENSE.txt`; GH reports NOASSERTION) | SVG (+`victory-canvas`) | **107,763** | **27** | `false` | peer only `react>=16.6.0` | 478k | **2025-12-19** |
| **LayerChart** | 2.3.0 (2026-08-20) | MIT | SVG/Canvas | — | 30 | — | **SVELTE ONLY — not React** | 237k | 2026-08-20 |
| **Unovis** (`@unovis/ts`) | 1.6.7 (2026-08-08) | Apache-2.0 | SVG + Canvas + **WebGL (three@0.135)** | **186,844** | **67** | 2-path array | `>=16.8 ‖ ^19` | `@unovis/react` **8.2k** | 2026-08-20 |
| **raw d3** | `d3-scale` 4.0.2 / `d3-shape` 3.2.0 / `d3-array` 3.2.4 | **ISC** | you render | **16,023 / 5,657 / 5,923** | 5/1/1 | **`false` (all three)** | n/a | 75.6M / 91.7M | frozen 2023 (stable) |
| **Vega-Lite** | 6.4.3 (2026-05-13) | BSD-3-Clause | Canvas + SVG (Vega runtime) | **87,293** (compiler only) | 6 | `true` | `react-vega@8` peers `^17‖18‖19` | 912k | 2026-08-19 |
| `react-vega` | 8.0.0 | (unset in npm) | — | 927 | 1 | `true` | needs `vega-embed ^7` | 292k | 2025-08-27 |

Stars / open issues: ECharts 67.1k/1551 · Chart.js 67.7k/579 · Recharts 27.5k/438 · visx 21.0k/148 · Nivo 14.1k/49 · Victory 11.2k/91 · uPlot 10.4k/150 · Vega-Lite 5.5k/818 · Plot 5.4k/346 · Tremor 3.6k/29 · Unovis 2.8k/102 · LayerChart 1.3k/69.

---

### 2. THE DECISIVE FINDING — RSC / `"use client"`

I grepped every published tarball for `"use client"` / `'use client'`:

> **Zero of the 11 packages ship a `"use client"` directive.** (recharts, @visx/shape, @visx/axis, @nivo/line, victory, react-chartjs-2, echarts-for-react, @unovis/react, @observablehq/plot, uplot, react-vega — all clean.)

So under Next.js **16.3.2** / React **19.2.8**, *every* consumer must author their own client boundary file. shadcn/ui's generated chart files confirm this — they all start with `"use client"`.

Then I checked what React actually allows on the server. From `react@19.2.8`'s `exports["."]["react-server"]` → `react.react-server.development.js`:

```
exports.use  exports.useCallback  exports.useDebugValue  exports.useId  exports.useMemo
```

`useMemo` / `useCallback` / `useId` **are** available in RSC. Then I audited visx's hook usage per file:

- `@visx/shape` (18 shape files): **17 use NO React hooks at all.** Only `SplitLinePath.js` uses `useMemo`. `BarRounded.js`'s `useBarRoundedPath` is a *plain pure function*, not a real hook (file imports only `react/jsx-runtime` + `classnames`).
- `@visx/axis` (15 files incl. `Axis`, `AxisBottom/Left/Top/Right`, `AxisRenderer`, `Ticks`): **zero hooks.** Only `react/jsx-runtime`.
- `@visx/group`, `@visx/grid`, `@visx/scale`: **zero hooks.** `@visx/scale` doesn't import React at all.
- `@visx/text`: `useMemo` only.

**Conclusion: `@visx/scale + shape + axis + grid + group + text + curve + gradient` render inside a React Server Component with NO client boundary.** Nothing else on this list does. Recharts cannot (RTK store + `Provider` + `ResponsiveContainer` measurement). Nivo cannot (`@react-spring/web` 10.1.2). ECharts/Chart.js/uPlot cannot (imperative DOM/Canvas in `useEffect`).

Observable Plot is the one oddity: it *can* SSR via the `document` option + `.toHyperScript()` (returns React vDOM, no `useEffect`), but requires a JSDOM-ish `Document` shim and their own docs say SSR "is only practical for simple plots of small data."

---

### 3. Composed bundle math

| Composition | gzip |
|---|---|
| `d3-scale` + `d3-shape` + `d3-array` (naive sum, standalone) | **27,603** — deduped ~25 KB; per-symbol tree-shaking is real (`sideEffects:false` on all three), so `scaleLinear`+`scaleBand`+`line`+`area`+`extent` lands far lower |
| visx cartesian kit: `scale 17,525` + `axis 15,189` + `shape 10,741` + `grid 11,425` + `text 6,255` + `curve 2,547` + `group 633` + `gradient 812` | naive sum **65,127**; heavily overlapping (`@visx/vendor`, `@visx/text`, `@visx/group` shared) → **deduped ESTIMATE 30–38 KB** (not directly measured) |
| `@visx/xychart` (batteries-included tier) | **49,924** (min 151,491, 16 deps) |
| Recharts 3 full | **125,523** + drags `@reduxjs/toolkit`, `react-redux`, `immer@11`, `reselect@5.2.0`, `es-toolkit`, `victory-vendor`, `decimal.js-light`, `eventemitter3` |
| ECharts tree-shaken (`echarts/core` + `LineChart` + `GridComponent` + `CanvasRenderer`) | **UNVERIFIED** — Apache publishes no byte figure; only quoted number is the SSR hydrate runtime at "less than 4KB" |
| Vega-Lite stack | 87,293 compiler + Vega runtime + `vega-embed` — **total UNVERIFIED, realistically 300 KB+** |

`@visx/vendor@4.0.0` gzip: **could not fetch** (bundlephobia returned null) — UNVERIFIED.

---

### 4. Granular-visual-control audit (your critical axis)

**visx — best in class, verified from `@visx/axis/lib/types.d.ts`:**
`numTicks`, `tickValues[]`, `tickLength`, `tickStroke`, `stroke`, `strokeWidth`, **`strokeDasharray`**, **`tickLineProps: Omit<SVGProps<SVGLineElement>,'to'|'from'|'ref'>`**, `labelOffset`, `labelProps`, `tickLabelProps` *(object OR `(value,index,values)=>Partial<TextProps>`)*, `tickComponent`, `ticksComponent`, `rangePadding: number | {start,end}`, `tickTransform`, `hideZero`, `hideTicks`, `hideAxisLine`, plus a `children: (AxisRendererProps) => ReactNode` render prop exposing `ticks: ComputedTick[]` with `{value,index,from:{x,y},to:{x,y},formattedValue}`.

`@visx/shape/Bar` is *literally* `{className?, innerRef?} & AddSVGProps<BarProps, SVGRectElement>` — every SVG attribute passes straight through. `BarRounded` exposes `radius` + eight per-corner booleans (`topLeft/topRight/bottomLeft/bottomRight/top/bottom/left/right/all`) **and** `children: ({path}) => ReactNode` so you can take the raw path string. `LinePath` / `AreaClosed` expose `children: ({path: d3.Line<Datum>}) => ReactNode` — the d3 generator itself. Bar inner/outer padding is *not* an opinion: you own `scaleBand().paddingInner()/paddingOuter()`.

**Recharts — very good, and 3.8+ finally exposes scales:**
`barCategoryGap` (default `"10%"`), `barGap` (default `4`), `barSize`, `maxBarSize`, `radius: RectRadius`; `XAxis`: `minTickGap` (default `5`), `padding:{left,right}`, `tick` (`false|true|object|ReactElement|fn`), `ticks[]`, `niceTicks`, `domain` (incl. `'dataMin - 100'` strings and fns), **`scale` accepts a live d3 scale object**; `CartesianGrid`: `strokeDasharray`, `horizontalPoints[]`, `verticalPoints[]`, `horizontalCoordinatesGenerator`, `syncWithTicks`, `fill`/`fillOpacity`, `horizontalFill`/`verticalFill` stripes.
Escape hatches exported from the root (verified in `types/index.d.ts`): `useXAxisScale`, `useYAxisScale`, `useCartesianScale`, `useXAxisInverseTickSnapScale`, `useXAxisTicks`, `useYAxisTicks`, `usePlotArea`, `useOffset`, `useXAxisDomain`. **But these only work *inside* a Recharts chart tree** — not standalone primitives.
v3 removals that bite composability: `CategoricalChartState` gone; `Customized` children no longer receive internal state; `activeIndex` removed from Scatter/Bar/Pie; `Cell` deprecated (3.7.0); `CartesianAxis` deprecated (3.6.0); multiple Y axes now sort **alphabetically by `yAxisId`**, not JSX order; z-index is now render order.

**Nivo — theme-object, not prop-level:** `lineWidth`, `areaOpacity`, `areaBaselineValue`, `areaBlendMode`, `gridXValues`/`gridYValues: TicksSpec<T>`, `curve`. No arbitrary SVG passthrough — your escape hatch is the `layers` array of render functions. Exposes `useLineGenerator`/`useAreaGenerator`/`useLine` hooks (client-only, `@react-spring/web`).

**Observable Plot — surprisingly granular but grammar-shaped:** axis marks take `ticks` (count | interval | array), **`tickSpacing`** (approx px between ticks — genuinely useful for your density USP), `tickSize` (6 default, 0 for fx/fy), `tickPadding` (3), `tickRotate`, `tickFormat`, `labelOffset`, `labelAnchor`, `textStroke`/`textStrokeWidth` (3)/`textStrokeOpacity`, `fontVariant` (defaults `tabular-nums`). Marks: `strokeWidth`, `strokeDasharray` (e.g. `"0.75,2"`), `fillOpacity`, `insetLeft`/`insetBottom`, `rx`/`ry`, scale-level `padding`/`inset`. **But scales are internal — you cannot get the scale function out.**

**ECharts — granular via one giant option blob:** `lineStyle.width`/`.type` (`'dashed'` or `[5,10]`), `itemStyle.borderRadius`, `areaStyle.opacity`, `axisLabel.margin`, `axisTick`, `splitNumber`, `interval`, `barGap`/`barCategoryGap`. Total control, **zero React composability** — you cannot put a React child anywhere inside a series.

**Chart.js / uPlot — Canvas:** `borderWidth`, `borderDash`, `borderRadius`, `barPercentage`/`categoryPercentage`, `ticks.maxTicksLimit`/`stepSize`/`padding`. No DOM nodes → **CSS custom properties can't cascade in**; you must `getComputedStyle().getPropertyValue('--chart-1')` and re-plot on theme change. This is disqualifying for a CSS-var-themed system.

**Tremor / shadcn:** shadcn is not a library — it's `pnpm dlx shadcn@latest add chart` copy-paste, wrapping Recharts v3 with `ChartContainer`/`ChartTooltipContent`, themed via `--chart-1`…`--chart-5` consumed as `var(--color-KEY)` (note the v3 migration: use `var(--chart-1)`, **not** `hsl(var(--chart-1))`). It is your real competitive baseline, not a build option.

---

### 5. Which expose a TRUE low-level scale/axis/shape primitive layer

| Verdict | Libraries |
|---|---|
| **YES — standalone, no chart container required** | **raw d3** (`d3-scale`/`d3-shape`/`d3-array`), **visx** (`@visx/scale`, `@visx/shape`, `@visx/axis`, `@visx/curve`, `@visx/group`, `@visx/grid` are 39 independently-versioned packages, each installable alone) |
| **YES but wrong framework** | **LayerChart** 2.3.0 — excellent primitive design, **Svelte-only, no React support whatsoever** |
| **PARTIAL — scales exposed but only inside the chart tree** | **Recharts 3.8+** (`useXAxisScale`/`useCartesianScale`/`useXAxisTicks`), **Nivo** (`@nivo/scales`, `@nivo/axes` exist but are coupled to nivo's theme + spring animation) |
| **NO** | ECharts, Chart.js, uPlot, Observable Plot (mark-level grammar; scales internal), Unovis, Vega-Lite (grammar/compiler, not primitives), Tremor, shadcn, Victory (`victory-core` has `Scale`/`Axis` but the API is theme-object-driven and the repo is 8 months cold) |

---

### 6. Eliminations, with reasons

- **Tremor** — `@tremor/react@3.18.7` last published **2025-01-13**, still pins **`recharts: ^2.13.3`** (a major behind), 222 KB gzip. The org pivoted `tremorlabs/tremor` to a copy-paste Tailwind+Radix model (Apache-2.0, repo cold since 2025-10-10). Dead end.
- **Victory** — repo cold since **2025-12-19** (before that, a 10-month gap to 2025-01-31), 27 packages, 108 KB gzip, peer dep still `react>=16.6.0` (no React 19 declaration), web presence migrated to `commerce.nearform.com`. GitHub reports NOASSERTION though `LICENSE.txt` is plainly MIT.
- **LayerChart** — Svelte. Not an option. Worth stealing the *API design* from.
- **Unovis** — 67 transitive deps including **`three@0.135.0`, `leaflet@1.7.1`, `maplibre-gl@^2.1.9`, `elkjs`, `supercluster`** at 187 KB gzip, and only **8,224 weekly downloads** on `@unovis/react`. Apache-2.0. Non-viable as a dependency.
- **Vega-Lite / react-vega** — declarative grammar is the *opposite* of "obsessively granular stroke widths"; total stack cost is 300 KB+; `react-vega@8` requires `vega-embed ^7` as a peer.
- **Chart.js, uPlot, ECharts** — Canvas-primary. Kills CSS-custom-property theming, kills SSR-without-hydration, kills per-element `data-*` targeting, kills accessible DOM. uPlot's 21.9 KB / 0-deps is genuinely excellent — keep it in your back pocket as an *optional* renderer for >50k-point series only.
- **Nivo** — `sideEffects: true`, 92 KB gzip for one chart type, `@react-spring/web` forces a client boundary, and the theme-object model fights per-element granularity. Repo healthy (last commit 2026-07-21) but 0.99.0 has sat since 2025-05-23.

---

## RECOMMENDATION

**Build a headless core on raw d3 primitives — `d3-scale@4` + `d3-shape@3` + `d3-array@3` (+`d3-format`, `d3-time-format`) — and render your own SVG. Do NOT adopt visx as a dependency; use it as the API reference.** Ship as `@yourorg/core` (scales/ticks/layout, zero React), `@yourorg/primitives` (RSC-safe SVG marks + axes), `@yourorg/grid` (the 12-col responsive shell), `@yourorg/react` (client-only interactivity: tooltip/brush/zoom).

Runner-up: **adopt visx** (`@visx/scale`, `@visx/shape`, `@visx/axis`, `@visx/curve`, `@visx/group`) as direct deps and layer your grid + information-density engine on top.

**Why d3-primitives wins for *this specific* library:** your USP — a widget that renders *different information content* at different grid sizes — is a **decision layer above the render layer**. No charting library models it, so you must own the render tree regardless. Once you own the tree, visx's marginal value collapses to "an `Axis` component and `BarRounded`'s corner math." Meanwhile `d3-scale`/`d3-shape`/`d3-array` are the two most-downloaded packages on this entire list (**91.7M** and **75.6M** weekly), are `sideEffects: false`, are ISC (MIT-compatible), and have been API-frozen since 2023 — which is stability, not abandonment.

### The 3 strongest tradeoffs vs. the runner-up (visx)

1. **You give up ~40 KB gzip of battle-tested, RSC-safe SVG components and must rewrite them.** visx's `AxisBottom` (tick positioning, `rangePadding: {start,end}`, `hideZero`, label transform, orientation sign) and `BarRounded`'s per-corner path math are non-trivial and already correct across 5.03M weekly `@visx/shape` installs. You will re-derive this and hit the same edge cases. **Mitigating counter-argument:** it's MIT, and `Bar` is literally `<rect {...props}/>` — the genuinely hard parts are `axis` (15.2 KB gzip) and `curve` (2.5 KB, a re-export of d3-shape curves you'd import directly anyway).

2. **d3 v7 packages are ESM-only, and you inherit that dual-publish burden.** This is exactly why Recharts ships `victory-vendor` ("a commonjs proxy to d3@latest") and why visx ships `@visx/vendor` — both exist *solely* to paper over d3's ESM-only move, which broke `recharts@2.1.13`/`2.1.14`. Adopting visx means someone else already solved this. Going raw means you own a `tsup`/rollup dual CJS+ESM build forever, plus Jest `transformIgnorePatterns` support tickets. **Counter:** visx's fix is `@visx/vendor`, an opaque pre-bundled blob whose gzip size I could not even measure — you'd be paying an unknown, un-tree-shakeable tax on every scale import (`@visx/scale` is **17,525 B gzip** standalone vs. `d3-scale` at **16,023 B** *with per-symbol tree-shaking that actually works*).

3. **You lose visx's release velocity as free maintenance — but visx's velocity is the weakest argument for adopting it.** `v3.12.0` shipped **2024-11-07**; `v4.0.0` shipped **2026-06-11**. That is a **19-month gap** on the only React-19 support release, and the breaking-change list was almost entirely toolchain (Node 18, TS 5, Yarn 4, drop prop-types, drop lodash, require React 18+, `@types/react` → optional peer). Depending on visx means your React-20 support is gated on a repo that shipped one release in two years. d3 has the opposite risk profile: frozen API, no React coupling, so *no* framework upgrade can ever break it.

### Two things to steal outright
- **visx's `tickLineProps`/`tickLabelProps`-as-function pattern** and the `children: (AxisRendererProps) => ReactNode` render prop exposing `ComputedTick[]` with `{value, index, from, to, formattedValue}` — this is the exact shape your granularity USP needs.
- **Observable Plot's `tickSpacing`** (approximate px between ticks). For a widget whose tick density must change with grid width, a px-budget API beats `tickCount` — expose both `tickCount` and `tickSpacing`, and let `tickSpacing` win at small breakpoints.

### One thing to do that nobody else does
**Ship `"use client"` correctly.** Zero of the 11 packages I unpacked ship the directive. Keep `@yourorg/primitives` 100% hook-free (or `useMemo`/`useId`/`useCallback`-only — verified available in React 19.2.8's `react-server` build) so static charts render as pure server HTML with no JS, and confine `"use client"` to `@yourorg/react`'s interaction layer. Against Recharts (RTK store, `ResponsiveContainer` measurement, renders nothing on the server) and shadcn's `"use client"`-on-every-chart baseline, that is a first-paint story no competitor can currently match.
