# shadcn/ui + Basedash comparison and reusable chart-library strategy

**Research date:** 2026-08-24  
**Repository:** /Users/SameeraD/Defence-Charts  
**Status:** research and architecture recommendation; no product code changed

## Executive decision

Do not replace the current chart core with Recharts or copy the shadcn chart implementation wholesale.

Adopt the *shadcn way of composing UI* around the current core:

- open, inspectable components;
- a small semantic ChartConfig separate from chart data;
- CSS-variable theme slots;
- composable chart primitives rather than an opaque mega-component;
- a chart/widget shell that consumers can replace or extend;
- a single documented sizing owner.

Keep the current project-owned differentiators:

- planChart() is pure and serialisable;
- ChartPlan changes the information contract as the box changes size;
- @gx/primitives can render on the server without a client boundary;
- @gx/react owns measurement and client interaction;
- the grid only owns placement and box geometry;
- TypeScript plan-input tokens are separate from CSS presentation tokens;
- unsupported chart types fail loudly instead of silently rendering the wrong mark.

The main next step is not a style rewrite. It is C1/C2: implement the real resizable grid and the BaseDash-like widget shell, then add a shadcn-inspired composition layer on top of it.

## Naming note: “BaseDash” is Basedash

The product referred to in the request is **Basedash** (one word, capital B, lowercase d). The authenticated application is closed-source. The evidence available for this comparison is:

1. Basedash’s official public documentation and embedding pages.
2. The public Basedash/react-grid-layout repository.
3. Visual inspection of the public marketing/dashboard mockup.
4. A prior workspace research pass that extracted the shipped production bundles and recorded the grid, chart, and CSS-token observations in [research/raw/02-basedash-grid-model.md](raw/02-basedash-grid-model.md).

The bundle observations below are marked **bundle evidence**. They are useful implementation clues, but they are not a promise that Basedash’s current private source still has the same names or versions.

## 1. What is already in Defence-Charts

### Current milestone status

The repository is beyond a “basic A1 and B” foundation for the current line/area slice. Its own implementation plan reports A1–A6 and B1–B3 as complete for line/area; C1/C2, breadth, and release remain. This distinction matters because the project is architecturally credible but not yet a finished resizable dashboard library.

| Area | Current state | Evidence | Meaning for this proposal |
|---|---|---|---|
| A1 foundation | Implemented | [research/30-implementation-plan.md](30-implementation-plan.md), [package.json](../package.json) | Build/test boundaries are already stronger than a typical copy-paste chart demo. |
| A2–A3 planner | Implemented for line/area | [packages/core/src/plan.ts](../packages/core/src/plan.ts), [packages/core/src/plan-chart.ts](../packages/core/src/plan-chart.ts) | This is the core IP; preserve it. |
| A4 renderer | Implemented for line/area/horizon/area/points/labels | [packages/primitives/src/Chart.tsx](../packages/primitives/src/Chart.tsx) | RSC-safe rendering exists. |
| A5–A6 adaptive client path | Implemented | [packages/react/src/AutoChart.tsx](../packages/react/src/AutoChart.tsx), [useElementSize.ts](../packages/react/src/useElementSize.ts) | Resize measurement and deadband are deliberate, not accidental. |
| B1 tokens | Implemented | [packages/tokens/src/tokens.ts](../packages/tokens/src/tokens.ts) | The token architecture can absorb a widget shell and chart-config bridge. |
| B2 renderer controls | Implemented for the current renderer | [research/44-granularity.md](44-granularity.md) | The control-surface work should become consumer-facing API documentation. |
| B3 plan policy/overrides | Implemented | [packages/core/src/policy.ts](../packages/core/src/policy.ts), [packages/core/src/overrides.ts](../packages/core/src/overrides.ts) | Keep size thresholds in serialisable TypeScript, not CSS. |
| C1 grid | Stub only | [packages/grid/src/index.ts](../packages/grid/src/index.ts) | This is the highest-value missing piece for the requested BaseDash-like experience. |
| D chart breadth | Not implemented | planChart() intentionally throws for future types | Add one chart family at a time after the grid contract is real. |
| E publication | Not ready | Packages are private and the scope is still @gx/* | “Reusable by any application” requires consumer fixtures and release gates. |

### The current architecture

~~~text
@gx/tokens
     ▲
@gx/core  ── pure data + size + policy ──▶ ChartPlan
     │
@gx/primitives  ── hook-free SVG/RSC renderer
     │
@gx/react  ── client measurement + interaction
     │
@gx/grid  ── intended 12-column placement/resize shell
~~~

The important existing boundary is:

~~~text
size + data shape + policy + overrides
              │
              ▼
        planChart()  ──▶  serialisable ChartPlan  ──▶  <Chart>  ──▶  SVG
~~~

@gx/core does not import React or the DOM. @gx/react measures the box and feeds the same pure planner. @gx/grid is intended to report the box and never decide what the chart means. This is a better foundation for adaptive charts than a direct ResponsiveContainer-inside-every-chart approach.

### What “reliable today” means

The current local evidence is:

- pnpm typecheck: passed across 14 tasks.
- pnpm test: passed, 33 files and 671 tests.
- The focused token, granularity, API, boundary, RSC, containment, and motion checks are present in the repository’s verification chain.
- pnpm lint:policy: currently fails under the workspace runtime because Node 22.12.0 cannot dynamically import the TypeScript source used by the policy gate; the repository requires Node >=22.18. The immediate error is Unknown file extension ".ts" from scripts/check-policy-thresholds.mjs.

Therefore the honest status is: **the line/area architecture is well-tested, but the complete release verification chain is not green in this local runtime, and the grid is not implemented.**

## 2. How shadcn/ui charts think

### shadcn is a composition and ownership model, not a chart engine

The official chart documentation describes a chart built from Recharts components inside a ChartContainer. The application still chooses and assembles BarChart, Bar, LineChart, axes, grid, series, animation, and interaction. shadcn contributes the local shell and a few adapters:

- ChartContainer;
- ChartConfig;
- ChartTooltipContent;
- ChartLegendContent;
- scoped CSS custom properties;
- Tailwind selectors for Recharts’ SVG classes;
- a small React context connecting config to tooltip/legend presentation.

The core principle is explicit composition. The consumer can still reach the underlying Recharts primitives. The source is copied into the consumer project and then owned by that project; it is not a sealed runtime component with a distant styling API.

Primary sources:

- [shadcn/ui Chart documentation](https://ui.shadcn.com/docs/components/base/chart)
- [shadcn/ui source repository](https://github.com/shadcn-ui/ui)
- [current chart source](https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/new-york-v4/ui/chart.tsx)
- [Recharts ResponsiveContainer API](https://recharts.github.io/en-US/api/ResponsiveContainer/)

### The useful shadcn contract

The practical contract looks like this:

~~~tsx
const chartConfig = {
  desktop: {
    label: 'Desktop',
    color: 'var(--chart-1)',
  },
  mobile: {
    label: 'Mobile',
    color: 'var(--chart-2)',
  },
} satisfies ChartConfig

<ChartContainer config={chartConfig} className='min-h-[200px] w-full'>
  <BarChart accessibilityLayer data={data}>
    <CartesianGrid vertical={false} />
    <XAxis dataKey='month' />
    <ChartTooltip content={<ChartTooltipContent />} />
    <Bar dataKey='desktop' fill='var(--color-desktop)' />
    <Bar dataKey='mobile' fill='var(--color-mobile)' />
  </BarChart>
</ChartContainer>
~~~

The useful ideas are:

1. **Data and semantic configuration are separate.** A data key does not have to carry its own human label, icon, or theme mapping.
2. **The config is per chart.** Generated --color-desktop variables are scoped to the chart element rather than being global series names.
3. **The chart remains composable.** A consumer can omit the tooltip, use a custom legend, or reach for any Recharts primitive.
4. **The shell is intentionally opinionated.** Tooltips, legends, typography, and default spacing look coherent without requiring a large design-system runtime.
5. **The shell has a measurable-parent contract.** A positive height, min-h-*, or aspect-* is required; otherwise the responsive plot can be zero-height.

### What shadcn does not solve

shadcn charts do not by themselves provide:

- an intent/data model;
- aggregation or query behavior;
- a responsive information ladder;
- mobile simplification;
- a grid layout or persisted layout;
- large-data virtualization or downsampling;
- loading, empty, or error state conventions;
- a complete data-table and alternate-text model;
- a full typography/number/date-format system;
- protection from Recharts major-version changes;
- protection from invalid flex/grid parent dimensions.

This is why a shadcn chart can look polished while still requiring application-level decisions for reliability and meaning.

### How it would look in this product

The visual direction should be **shadcn-like in composition, not necessarily shadcn-like in skin**:

- compact widget header;
- title and description in semantic HTML;
- a value/trend slot above or beside the plot when the plan allows it;
- plot with sparse gridlines and restrained axis chrome;
- tooltip and legend that read from typed series metadata;
- optional footer/data table inside the figure boundary;
- CSS custom properties for every presentation choice;
- consumer-overridable class hooks, with no Tailwind dependency in the core packages.

The Rail visual system can remain the default skin. A neutral “escape-hatch” theme can approximate the Basedash/shadcn dark dashboard look without changing the planner.

## 3. What Basedash contributes

### Product-level pattern

Basedash’s public docs describe this pipeline:

~~~text
natural-language intent
        ▼
SQL / metric definition
        ▼
curated visualization + formatting
        ▼
resizable, shareable dashboard layout
~~~

The public chart docs list line, timebar, horizontal bar, pie, funnel, scatter, Sankey, table, number, progress, text, header, detail, activity, map, and image visualizations. They also describe chart selection by data type, query intent, data volume, and visualization best practices.

Sources:

- [Basedash charts documentation](https://www.basedash.com/docs/features/charts)
- [Basedash dashboards documentation](https://www.basedash.com/docs/features/dashboards)
- [Basedash embedding](https://www.basedash.com/features/embedding)
- [Basedash brand page](https://www.basedash.com/brand)
- [Basedash public grid fork](https://github.com/Basedash/react-grid-layout)

The semantic/query layer is intentionally out of scope for this library. Defence-Charts should stay presentational: consumers pass already-shaped data and can build their own query, AI, or semantic layer around it. That keeps the package reusable in apps that do not use SQL or AI.

### Grid model: verified and inferred parts

The local bundle analysis in [research/raw/02-basedash-grid-model.md](raw/02-basedash-grid-model.md) found the following production geometry:

| Concern | Bundle observation | Recommendation |
|---|---|---|
| Normal dashboard | 6 columns | Keep a 12-column canonical model for portability; provide a 6-column view only as a layout preset. |
| Wide dashboard | 12 columns | This maps naturally to the current design. |
| Ultrawide dashboard | 18 columns | Support later as a layout preset, not as the core chart contract. |
| Nominal cell/row | 188px | Use as a reference preset, never as a chart threshold. |
| Gutter | 12px | Good default for the grid shell; keep it tokenised. |
| Container padding | 12px per side | Good shell default; consumers should be able to change it. |
| Narrow mode | containerWidth <= 480 becomes single column | Let the grid own this layout behavior; do not make chart semantics depend on it. |
| Resize handles | Four corners | Strong default for a dashboard builder. |
| Compaction | Vertical, no overlap, push-down | Use the grid engine’s tested behavior; expose the policy rather than reimplementing it. |
| Per-widget min sizes | None found in the Basedash bundle | Add them in Defence-Charts; a chart should be able to declare when it becomes meaningless. |

The important separation is:

~~~text
grid: placement, collision, compaction, resize, persistence
chart: size measurement, information plan, rendering, accessibility
~~~

Basedash’s public docs verify dragging/resizing, tabs, headers, Markdown text blocks, grouping, and sharing. They do not publicly verify the current private persistence implementation, the exact current production grid-library version, or breakpoint-specific persistence. Treat those as inference, not fact.

### Chart and rendering observations

The local production-bundle analysis found:

- visx class names and components in the shipped chart code;
- a MeasuredParentSize render-prop supplying width and height;
- common line/bar/pie/axis/group primitives;
- a tick-density function that estimates label width and keeps the first/last ticks while thinning intermediate ticks;
- line-chart behavior that hides axes below roughly 200px and adds end values above roughly 800px;
- a two-layer CSS custom-property token system;
- compact number formatting and chart-specific label/axis colors.

These observations are valuable because they prove Basedash already changes information content with size in at least one chart implementation. They also show the limitation: the behavior is a small set of pixel thresholds in one renderer, not a typed, grid-unit-aware, chart-family-wide contract.

The public docs verify the broader semantic rules:

- horizontal bars for larger category sets;
- pie for small category sets;
- line/timebar for trends;
- funnels for staged conversion;
- scatter for numeric relationships;
- roughly 3–8 breakdown categories as a clarity guideline;
- roughly 15–20 categories as a horizontal-bar readability guideline.

These are useful policy inputs for future chart families, but they should be encoded as project-owned policy with provenance labels, not presented as universal scientific thresholds.

### Typography and visual style

The public dashboard mockup suggests a restrained dark analytics UI:

- near-black canvas and slightly lighter card surfaces;
- thin, low-opacity borders instead of heavy shadows;
- compact card headers and metadata;
- large high-contrast primary values;
- muted comparison labels;
- green/red deltas as semantic signals;
- sparse colored series on dark plots;
- approximately 10–11px compact metadata and approximately 18px dashboard titles in the inner UI.

The marketing page is not an authenticated application screenshot, so those pixel estimates are directional rather than a source of exact typography tokens. The reusable lesson is hierarchy:

~~~text
dashboard title / widget title
        ▼
primary metric + delta
        ▼
plot / table
        ▼
period, source, refresh, or explanatory metadata
~~~

Defence-Charts already has a stronger evidence-led typography system than the public mockup: its metrics and token provenance live in [research/41-text-metrics.md](41-text-metrics.md) and [research/42-typography.md](42-typography.md). Basedash should influence the shell hierarchy and compactness, not replace those measured defaults with visual guesswork.

## 4. Comparison: current system vs shadcn vs Basedash

| Dimension | Current Defence-Charts | shadcn/ui charts | Basedash |
|---|---|---|---|
| Primary abstraction | Pure ChartPlan + renderer | ChartContainer + Recharts composition | Semantic chart/dashboard product |
| Data/config split | Shape feeds planner; plan is separate | ChartConfig separate from data | Query/metric definition separate from chart type |
| Resizing | AutoChart measures; grid is planned but stubbed | Parent ResizeObserver; height must be explicit | Draggable/resizable dashboard cards |
| Size adaptation | Changes marks, axes, labels, legend, table, etc. | Mostly resizes the same chart | Some pixel-threshold behavior observed in production bundle |
| Grid | Intended 12 columns; C1 not complete | No dashboard grid | 6/12/18-column production geometry observed |
| Rendering | Project-owned SVG, d3 math, RSC-safe primitives | Recharts SVG | Production bundle indicates visx |
| Theme model | Generated --gx-* tokens + typed policy | Scoped CSS variables + Tailwind | Private/public CSS variable layers |
| Typography | Measured font metrics and size ranks | Lightweight text-xs, mono/tabular tooltip defaults | Compact dashboard hierarchy, exact private tokens unavailable |
| Accessibility | Title/description, graphics-document, data table, non-color encodings | Recharts accessibilityLayer and tooltip behavior | Public docs do not expose a complete chart a11y contract |
| Distribution | Intended npm packages, still private | Copy/paste source ownership | Closed SaaS / iframe embed |
| Best lesson | Keep the planner and server boundary | Copy the semantic config and composition ergonomics | Build the grid/widget shell and compact hierarchy |

## 5. Recommended library architecture

### Keep the existing package graph

The current packages are already close to the right separation:

~~~text
@gx/tokens
     ▲
@gx/core ────────────────┐
     │                    │
@gx/primitives            │
     │                    │
@gx/react                 │
     │                    │
@gx/grid                  │
                          │
@gx/widget / @gx/ui  ◀────┘  new composition shell
~~~

The exact public scope is still open. @gx/widget is a role name for this document, not a locked package name.

### Proposed responsibilities

#### @gx/core

Keep it pure and framework-independent:

- ChartPlan;
- planChart();
- SizeContext;
- DataShape;
- PlanPolicy and PlanOverrides;
- scales, ticks, layout math, format decisions;
- one ladder per chart family.

Add no CSS reads, no React context, no fetching, no SQL, no AI, and no dashboard persistence.

#### @gx/primitives

Keep the render tree hook-free:

- marks, axes, grids, legends, labels, data table;
- accessible SVG/HTML composition;
- stable identity across transitions;
- no presentation literals in JSX;
- renderer-specific implementation behind subpath exports where bundle measurements justify it.

#### @gx/react

Keep browser-only behavior here:

- AutoChart;
- one ResizeObserver owner;
- tooltip/crosshair/brush/legend interaction;
- focus and keyboard behavior;
- loading/empty/error state orchestration if it needs client state.

The package description currently advertises tooltip, crosshair, brush, and legend interaction, but the source currently contains only the measurement/AutoChart path. Either implement those contracts or narrow the package description until they exist.

#### @gx/grid

This is the immediate implementation target:

~~~ts
type GridItem = {
  id: string
  x: number
  y: number
  w: number
  h: number
  minW?: number
  minH?: number
  maxW?: number
  maxH?: number
  static?: boolean
}

type DashboardGridProps = {
  items: readonly GridItem[]
  columns?: 6 | 12 | 18
  rowHeight?: number
  gutter?: number
  containerPadding?: number
  onLayoutChange?: (items: readonly GridItem[]) => void
  children: React.ReactNode
}
~~~

The grid should:

- use react-grid-layout@2's `./core` algorithms/types behind the client components/hooks exposed by
  `./react`, with the exact wrapper boundary verified in C0;
- use a pinned, verified version rather than a caret range while the layout bug history is known;
- default to 12 columns;
- ship the locked 12-column public contract in v1; treat 6/18-column profiles as a later proposal
  with migration and contract tests;
- use corner resize handles;
- support vertical compaction and collision push-down;
- apply per-widget min/max constraints;
- serialize only layout, not chart semantics;
- pass each widget its actual pixel box and grid cols/rows in SizeContext;
- never choose a chart type or rewrite a plan.

#### @gx/widget or @gx/ui

This is the missing shadcn-like layer. It should be composable rather than a mandatory card:

~~~tsx
<ChartFrame config={config}>
  <ChartHeader>
    <ChartTitle />
    <ChartDescription />
    <ChartActions />
  </ChartHeader>
  <ChartValue />
  <ChartPlot>
    <Chart plan={plan} data={data} />
  </ChartPlot>
  <ChartLegend />
  <ChartFooter />
</ChartFrame>
~~~

Responsibilities:

- ChartConfig semantic series metadata;
- chart-local CSS variable projection (--gx-color-<key> or an equivalent prefixed form);
- title, description, value, delta, footer, refresh, and action slots;
- tooltip and legend content adapters;
- compact/full-width variants;
- empty/loading/error/insufficient-size states;
- no data fetching and no dashboard persistence.

This should be usable without Tailwind. A consumer using shadcn/Tailwind can add its own class names; the library should ship plain CSS variables and class hooks so a Vue, Svelte, vanilla, or CSS-module consumer is not forced to install a React/Tailwind stack for the token system.

#### Optional @gx/shadcn adapter

Only add this if real consumers need it. It could provide:

- shadcn-compatible class-name recipes;
- Tailwind examples;
- ChartContainer-style aliases;
- a ChartConfig bridge that maps color and theme entries to @gx/tokens.

It must depend on the public shell, not the other way around. The core library must not become coupled to Tailwind, Radix, or Recharts merely because shadcn is a popular integration style.

### A stronger ChartConfig

Copy shadcn’s semantic separation, then extend it for this library’s honesty requirements:

~~~ts
type ChartConfig = {
  series: Record<string, {
    label: React.ReactNode
    icon?: React.ComponentType
    color?: string
    shape?: 'circle' | 'square' | 'triangle' | 'diamond' | 'cross' | 'plus'
    dash?: 'solid' | 'short' | 'long' | 'dot'
  }>
  format?: {
    x?: 'date' | 'datetime' | 'category' | 'number'
    y?: 'number' | 'currency' | 'percent' | 'compact'
  }
  accessibility?: {
    summary?: React.ReactNode
    table?: 'auto' | 'always' | 'never'
  }
}
~~~

The exact type should be designed after the first real tooltip/legend implementation. The principle is settled: labels, colors, icons, formatters, and redundant identity encodings are metadata, not hard-coded into the data array.

### Keep the token split

Do not make CSS variables feed planner thresholds. The current architecture correctly separates:

| Token kind | Mechanism | Examples |
|---|---|---|
| Presentation | CSS custom properties | line width, color, gap, radius, tooltip surface, transition duration |
| Plan input | serialisable TypeScript | tick target spacing, minimum plot height, point budget, aggregate threshold, text metrics |

If a CSS custom property changes the planner result, the server and client can disagree and hydration can diverge. The shadcn pattern is strong for presentation tokens; the current PlanPolicy pattern is strong for behavior thresholds. Keep both.

## 6. Reliability assessment

### Reliability of a shadcn-style change

**High for the visual composition layer; medium for a complete chart system.** shadcn’s small source surface and direct Recharts escape hatch are reliable for an application team that is willing to own the copied code. They are not evidence that the chart is reliable in every layout or data condition.

Main shadcn/Recharts risks:

- the parent must have a positive measurable height;
- hidden tabs and collapsed panels can initially measure zero;
- nested responsive containers can fight over measurement;
- Tailwind selectors can depend on Recharts’ SVG class structure;
- copied components drift across applications;
- Recharts major-version changes can change tooltip, responsive, or accessibility behavior;
- SVG cost grows with very large point counts;
- custom tooltip content can lose live-region semantics;
- default typography and number formatting are intentionally lightweight.

### Reliability of the current Defence-Charts approach

**High for the pure line/area planner and renderer; not yet complete for the requested product.**

Strengths already present:

- deterministic plan snapshots;
- no DOM measurement in the resolver;
- serialisable server/client contract;
- explicit containment rules for the measured box;
- injected resize observer in tests;
- SSR/RSC fixture coverage;
- accessible title/description and a data-table path;
- loud failure for unsupported chart types;
- generated token source and provenance gates;
- CSS transition path with reduced-motion handling.

Missing before calling the resizable-grid library reliable:

1. real @gx/grid layout implementation;
2. layout serialization/restore tests;
3. min-size semantics and chart-family constraints;
4. browser drag/resize tests across all rung boundaries;
5. no-loop/fixed-point tests with real grid geometry;
6. widget chrome that cannot change the measured chart box accidentally;
7. tooltips, legend interactions, keyboard navigation, and screen-reader checks;
8. visual regression fixtures for light/dark/compact/full-width states;
9. package exports, peer dependency validation, and a real external consumer fixture;
10. a Node >=22.18 CI environment or a policy-gate fix that does not import raw TypeScript.

### Reliability rules for the grid/chart seam

The following rules should become API and test contracts:

- One owner measures a chart box.
- The grid owns the outer box; chart content may never determine its height.
- Header/footer/table content must be inside a reserved widget region or outside the measured chart wrapper; never let normal-flow siblings silently reduce the observed plot height.
- Every grid item has a stable id independent of chart type and data order.
- Layout persistence stores geometry and identity, not a rendered ChartPlan.
- Replanning must be pure for the same SizeContext, data shape, policy, and overrides.
- Crossing a size boundary in either direction must be reversible.
- Unsupported chart families throw during development and produce a typed fallback state in the consumer-facing shell, never a wrong mark.
- A chart that cannot carry readable values must not display a value-legibility claim.
- Color must be supplemented by shape, dash, label, or table information where the plan requires it.

## 7. Recommended phased plan

### Phase 0 — contract freeze and consumer-facing names

**Estimate: 1–2 days.**

- Decide the final package scope/name instead of shipping @gx/* placeholders.
- Add a ChartConfig contract without using it to drive planner decisions.
- Define GridItem, DashboardGridProps, and WidgetFrame types.
- Decide whether the new shell is @gx/widget, @gx/ui, or an internal docs-layer package first.
- Pin the known-good grid-engine version; do not keep a broad caret range around a layout bug.

### Phase 1 — BaseDash-like grid shell

**Estimate: 4–7 engineering days for a working internal slice; 1–2 additional weeks for hardening.**

- Implement the react-grid-layout core wrapper.
- Add 12-column layout with 6/12/18 presets.
- Add four-corner resizing, vertical compaction, collision push-down, and per-item min/max.
- Serialize/restore layouts.
- Pass actual pixel and grid dimensions into AutoChart.
- Add a browser test that drags one widget across Micro → Stage boundaries.
- Add a browser test that repeatedly resizes across a boundary and asserts no resize-loop error, no content-owned height, and no identity churn.

This is the most important change for the requested product. It is not a shadcn migration; it is C1.

### Phase 2 — widget and chart composition shell

**Estimate: 3–6 engineering days for line/area.**

- Add ChartFrame, ChartHeader, ChartTitle, ChartDescription, ChartValue, ChartPlot, ChartLegend, ChartFooter, and ChartActions as composable pieces.
- Add ChartConfig and scoped series variables.
- Build tooltip and legend adapters against the current render tree.
- Add compact/full-width variants and empty/loading/error states.
- Align the shell with Basedash’s hierarchy while retaining the Rail/Neutral themes.
- Add docs examples showing both “all-in-one” and headless composition.

### Phase 3 — interaction and accessibility hardening

**Estimate: 1–2 weeks.**

- Implement tooltip, crosshair, brush, and legend interaction or remove them from the advertised package description until they exist.
- Add keyboard focus and arrow-key behavior.
- Preserve the existing graphics-document, title/description, and data-table contracts.
- Verify custom tooltip live-region behavior with VoiceOver/browser tests.
- Add high-contrast, reduced-motion, print, and color-vision checks.

### Phase 4 — chart breadth

**Estimate: 1–2 weeks per chart family once the first pattern is proven.**

Recommended order:

1. bar/column;
2. donut/pie;
3. KPI/number;
4. scatter;
5. activity heatmap;
6. funnel, progress, and specialized types.

Each family needs its own complete ladder, plan fields, data shape, renderer, accessibility, tests, and visual fixtures. Do not make a single generic renderer grow a large number of hidden type flags.

### Phase 5 — publishable reusable library

**Estimate: 1–2 weeks after the first two chart families.**

- make packages public and choose the final scope;
- define stable export maps and CSS subpaths;
- validate tree-shaking and peer dependencies;
- add an external consumer app fixture;
- add release automation and changelog policy;
- document SSR, sizing, grid, theming, and upgrade contracts;
- publish preview packages before claiming compatibility.

### Overall estimate

For one engineer working in the current codebase:

| Outcome | Rough effort |
|---|---:|
| shadcn-like shell around the existing line/area chart | 3–6 days |
| working BaseDash-like resizable grid plus line/area widgets | 1–2 weeks |
| hardened line/area reusable library with consumer fixture | 3–5 weeks |
| first credible catalog (bar, donut, KPI, scatter, heatmap) plus release work | 6–10+ weeks |

These are planning estimates, not measured delivery times. The main variable is not styling; it is browser verification, grid persistence, interaction accessibility, and the number of chart families included in “library.”

## 8. What is worth improving now

### High priority

1. **Implement C1 before adding more token breadth.** The product promise is a resizable grid of adaptive charts; the grid is currently the largest missing runtime piece.
2. **Separate widget chrome from plot measurement.** A Basedash-like header/value/footer must not accidentally become part of the chart’s observed height.
3. **Add a semantic ChartConfig.** This is the cleanest lesson from shadcn and will make tooltip, legend, theme, and accessibility work coherent.
4. **Add a consumer fixture.** The packages are still private; a second app consuming the built exports will expose what internal workspace imports hide.
5. **Pin and verify the grid engine.** The current @gx/grid manifest uses react-grid-layout with a caret range while the research already records a version-specific layout concern.
6. **Close the policy-gate runtime mismatch.** A reliability story cannot end with the full verify chain failing in the supported local environment.

### Medium priority

- Add compact-number and full-number formatting modes inspired by Basedash.
- Add cached-result/refresh states to the widget shell without coupling the core to fetching.
- Add dashboard-level filter context only as an optional consumer-layer package; do not put SQL or AI semantics into @gx/core.
- Add a first-class read-only/embed mode at the shell level if external dashboards are a target.
- Add 6/12/18 grid presets, but keep chart planner semantics driven by the actual SizeContext.

### Avoid for now

- swapping d3/project-owned SVG for Recharts merely to match shadcn examples;
- adding Tailwind as a runtime dependency of the core packages;
- copying Basedash’s private visual values as if they were public specifications;
- adding AI/query/persistence to a presentational library;
- exposing every renderer option as an untyped escape hatch;
- calling the library production-ready before C1, interaction, consumer-fixture, and release gates are complete.

## 9. Final recommendation

Build a **shadcn-inspired, Basedash-informed, project-owned adaptive chart library**:

- shadcn supplies the composition vocabulary and consumer ergonomics;
- Basedash supplies the dashboard hierarchy, grid feel, compact metric treatment, and curated chart catalog;
- Defence-Charts supplies the pure responsive planner, honest information ladder, server-safe SVG, token provenance, and stronger containment contract.

The right next artifact after this research is a C1 implementation brief for the grid/widget seam, not a Recharts migration. Once that seam is real, the same ChartPlan can drive both a polished Basedash-like dashboard and a headless composition API that any application can adopt without fighting the sizing, theming, or server-rendering model.

## Sources and evidence tiers

### Official external sources

- [shadcn/ui Chart docs](https://ui.shadcn.com/docs/components/base/chart)
- [shadcn/ui repository](https://github.com/shadcn-ui/ui)
- [shadcn/ui chart source](https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/new-york-v4/ui/chart.tsx)
- [Recharts ResponsiveContainer](https://recharts.github.io/en-US/api/ResponsiveContainer/)
- [Basedash Charts docs](https://www.basedash.com/docs/features/charts)
- [Basedash Dashboards docs](https://www.basedash.com/docs/features/dashboards)
- [Basedash Embedding](https://www.basedash.com/features/embedding)
- [Basedash public React Grid Layout fork](https://github.com/Basedash/react-grid-layout)

### Workspace evidence

- [research/00-decisions.md](00-decisions.md) — locked architecture and reliability decisions.
- [research/20-architecture.md](20-architecture.md) — package graph and server/client boundary.
- [research/30-implementation-plan.md](30-implementation-plan.md) — milestone status and next work.
- [research/40-chart-plan.md](40-chart-plan.md) — serialisable responsive plan contract.
- [research/raw/02-basedash-grid-model.md](raw/02-basedash-grid-model.md) — extracted Basedash grid, chart-bundle, and CSS-token evidence.
- [research/raw/03-landscape-charting.md](raw/03-landscape-charting.md) — charting-library and shadcn/Recharts landscape.
- [research/41-text-metrics.md](41-text-metrics.md) and [research/42-typography.md](42-typography.md) — current typography evidence.

### Evidence labels used here

- **Official:** public vendor documentation, source repository, or API documentation.
- **Bundle evidence:** observation from the shipped Basedash production bundle recorded in the existing workspace research; useful but subject to private-app drift.
- **Inference:** recommendation derived from the evidence, not a claim about private implementation.
