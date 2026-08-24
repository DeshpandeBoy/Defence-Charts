# 82 — Package ecosystem benchmark and Defence-Charts package audit

**Revision:** 2026-08-24
**Status:** research-backed architecture recommendation; vendor terms and pricing are time-sensitive.
**Question:** How do comparable chart, grid, and React component packages divide Free/Pro/Enterprise,
how do they distribute and enforce those tiers, and where does this repository need to change?

## Executive answer

Comparable libraries use four commercial patterns:

1. **Open core plus separate paid packages:** MUI X and AG Grid. The free package is a real product;
   Pro/Premium or Enterprise packages add advanced features and use commercial licensing.
2. **Broad package plus commercial licence:** Highcharts. The package contains a wide chart catalogue,
   but production/commercial use is governed by a commercial licence.
3. **Free subset inside a non-open suite:** KendoReact and Syncfusion. Free components are useful, but
   the source and premium feature boundary remains vendor-controlled and licence keys are part of the
   workflow.
4. **Open composition or open engine:** shadcn/ui, Recharts, ECharts, Nivo, and Plotly’s open-source
   packages. They optimise adoption, composition, and ecosystem reach rather than charging for a
   local render.

For this repository, the strongest combination is:

> **Use MUI/AG Grid’s package separation, shadcn’s composition ergonomics, ECharts’ import granularity,
> and our own pure `ChartPlan`/responsive-ladder architecture. Do not copy the runtime licence-key
> model of KendoReact or Syncfusion into the renderer.**

The package decision should be:

```text
Free and public
  @gx/core        pure plans, data contracts, scales, layout math
  @gx/tokens      CSS variables and typed tokens
  @gx/primitives  RSC-safe SVG marks and static Chart
  @gx/react       AutoChart and basic client interaction boundary
  @gx/grid        resizable 12-column widget grid and basic chrome
  @gx/testing     public development/test helpers

Pro and separately licensed
  @gx/pro-charts      specialized chart families
  @gx/pro-export      PNG/PDF/print/batch export
  @gx/pro-renderer    optional Canvas/WebGL/high-volume renderer
  @gx/pro-themes      premium theme packs and system adapters
  @gx/pro-composition linked views and advanced dashboard interactions

Premium / Enterprise service and contract
  organization seats, private registry, SSO, audit, SLA/LTS,
  security evidence, custom design-system work, private/offline delivery
  optional @gx/cloud-client only for a separate hosted product
```

The current code is not ready to split paid packages yet. The main blockers are not billing; they are
the unfinished grid, unfinished chart breadth, publication metadata, and an incomplete Pro renderer
extension seam.

## 1. Benchmark criteria

Each comparison was evaluated against the same questions:

| Criterion | Why it matters here |
|---|---|
| Free boundary | Tells us which foundation must remain complete for adoption |
| Paid boundary | Shows what users accept paying for: breadth, scale, support, or code |
| Package shape | Indicates whether Pro should be a sibling package, subpath, module, or same package |
| Licence enforcement | Distinguishes legal/package access from runtime checks and watermarks |
| Upgrade path | Measures how much friction a consumer experiences when moving to paid features |
| Developer/deployment model | Helps choose organization, developer-seat, application, or deployment licensing |
| Support and maintenance | Shows what Premium/Enterprise can sell without complicating rendering |
| Bundle and tree-shaking model | Matters for a chart library whose value includes small, predictable output |
| Server/client behavior | Matters because this repository deliberately has an RSC-safe static path |

Research used first-party documentation and official package/source repositories. Prices, eligibility,
licence terms, and product behavior should be re-checked before a commercial launch.

## 2. Comparable package models

### 2.1 MUI X — the closest Free/Pro/Premium package pattern

MUI X explicitly calls itself open-core. Its Community package is MIT and free forever; Pro and
Premium add advanced components/features under a commercial licence. The paid products are separate
npm packages such as `@mui/x-charts-pro` and `@mui/x-charts-premium`. Upgrading normally means
installing the paid package and replacing imports with the paid component path. See
[MUI X licensing](https://mui.com/x/introduction/licensing/).

Important observations:

- **The free layer is not a demo.** MUI calls Community a free-forever package and keeps MIT code
  under MIT.
- **Paid code is a sibling package.** This makes the boundary visible in `package.json` and imports;
  it does not require a hidden “unlock” flag inside every component.
- **Pro and Premium are feature tiers.** The examples include advanced grid filtering/sorting,
  column pinning, row grouping, Excel export, and advanced charts.
- **The license is still checked at runtime.** MUI documents `@mui/x-license`, a key installed before
  React renders, with watermarks/console warnings for missing or invalid commercial keys.
- **The commercial contract is version-aware.** The current pricing documentation distinguishes annual
  maintenance/update access from perpetual use of licensed versions.
- **Their licensing language is changing.** MUI’s 2026 pricing announcement describes application-based
  options while the licensing page still explains concurrent-developer examples. Treat current plan
  and seat terms as a moving contract, not as a stable technical rule.

**Lesson for Defence-Charts:** adopt the separate-package upgrade shape. Do not adopt browser licence
validation as a requirement for Free or for the static renderer. If a key is ever needed, keep it in
an optional Pro/Enterprise layer and make failure non-destructive.

### 2.2 AG Grid / AG Charts — separate package, module-level tree-shaking, licence watermark

AG Grid installs Community from `ag-grid-community` and Enterprise from `ag-grid-enterprise`. The
official docs describe Community as free for production and Enterprise as a commercial licence. The
Enterprise package can be tested without a key, but missing keys produce a watermark and console
message. See [Community vs Enterprise](https://www.ag-grid.com/javascript-data-grid/community-vs-enterprise/)
and [installation](https://www.ag-grid.com/javascript-data-grid/installation/).

Important observations:

- **Sibling package boundary:** `ag-grid-community` and `ag-grid-enterprise` make the paid code path
  explicit.
- **Feature registration boundary:** modules are explicitly registered and can be cherry-picked to
  reduce bundle size. See [AG Grid modules](https://www.ag-grid.com/javascript-data-grid/modules/).
- **Enterprise is more than code:** dedicated support, advanced features, and a commercial licence
  are sold together.
- **Licence keys are visible in JavaScript:** AG Grid explicitly acknowledges that a distributed
  JavaScript product can expose the key; the key is a legal signal, not a secret.
- **Their product catalogue is composable:** AG Grid and AG Charts can be separate, with integrated
  chart features adding another package/module boundary.

**Lesson for Defence-Charts:** keep advanced chart families and high-volume renderers as explicit
Pro packages or subpath modules. Borrow module-level tree-shaking and development diagnostics. Avoid
making a licence watermark part of the ordinary Free render path.

### 2.3 Highcharts — broad chart catalogue with commercial production licensing

Highcharts documents Core as a charting library with 40+ chart types, and its official npm package
includes Highcharts plus Stock, Maps, and Gantt packages. Its documentation states that production
and commercial use require a commercial licence. It also documents product-specific bundles and
tailored builds. See [Highcharts download and licensing](https://www.highcharts.com/download/) and
[installation](https://www.highcharts.com/docs/getting-started/installation).

Important observations:

- **The package is broad rather than Free/Pro split at the chart-family level.** Users install the
  main package and select modules/products.
- **The main boundary is legal usage.** Evaluation/CDN use is separated from commercial production
  use by the licence terms.
- **Product bundles still provide granularity.** Stock, Maps, Gantt, and module imports support
  smaller or more targeted builds.
- **The licence covers the product, not only an individual feature.** This is a strong commercial
  model for an established vendor but creates more procurement friction for a new library.
- **Highcharts Grid now documents Lite and Pro npm packages**, demonstrating that even a broad
  commercial vendor can create a separate paid package when the product boundary is clear.

**Lesson for Defence-Charts:** do not make the first release “everything is proprietary but free to
try.” A Free public chart/grid foundation will be easier to adopt. Use broad package breadth only
after the core API and support obligations are mature.

### 2.4 KendoReact — free subset in a non-open commercial suite

KendoReact states that its Free components can be used in production with no licence, while the full
suite contains 120+ free and premium components. It is not open source; source access is a commercial
benefit. Premium components/features require a licence key file, and missing keys produce warnings and
watermarks. See [Free vs Premium](https://www.telerik.com/kendo-react-ui/components/getting-started/free-vs-premium)
and [licence activation](https://www.telerik.com/kendo-react-ui/components/my-license).

Its FAQ documents perpetual product use after a one-year subscription, with updates and support tied
to the subscription. It also documents offline licence activation/validation and no network requests
during the project lifecycle. See [KendoReact licensing FAQ](https://www.telerik.com/kendo-react-ui/pricing/faq).

Important observations:

- **Free and premium functionality can coexist within the same package/component family.** A single
  grid can have free and premium features.
- **The free version is commercially usable but not open source.** Users receive a product right,
  not source ownership.
- **Activation is developer-tooling oriented.** A CLI downloads/activates a local licence file, which
  is convenient for CI and avoids a runtime network dependency.
- **Premium can be enforced with warnings/watermarks without blocking all evaluation.** This is a
  deliberate legal-and-product compromise.

**Lesson for Defence-Charts:** offline licence files are a viable Enterprise option. However, mixing
Free and paid features inside the same package would make our open-core boundary less clear and would
complicate tree-shaking, RSC, and community contributions. Prefer sibling Pro packages first.

### 2.5 Syncfusion — commercial suite with eligibility-based Community licence

Syncfusion’s React Charts page describes the chart product as commercial and says that a free
Community licence is available for organizations under specified revenue, developer, and employee
thresholds. Its licensing guide requires a valid key for trial, paid, or Community use and displays a
licensing notice when the key is missing. See [React Charts](https://www.syncfusion.com/react-components/react-charts)
and [licensing overview](https://react.syncfusion.com/react-ui/licensing/overview/).

The public React component page also states that licensing is per developer and does not charge
runtime, royalty, or deployment fees. Treat the exact thresholds and terms as time-sensitive.

Important observations:

- **Free is eligibility-based, not universally open.** The user must determine whether the organization
  qualifies.
- **Licence registration is part of application startup.** This is acceptable for a suite designed
  around commercial licensing but not ideal for our “no network, RSC-safe, presentational-only” core.
- **The vendor sells a wide surface:** chart, grid, scheduler, forms, and document components,
  allowing bundle purchasing and enterprise support.

**Lesson for Defence-Charts:** do not copy organization-size gates into Free. They would make adoption
and open-source use harder and create legal/support questions before our product has customers.

### 2.6 Apache ECharts — open-source engine with import granularity

Apache ECharts is Apache-2.0 licensed and installable from npm. Its documentation supports a simple
full import and recommends importing `echarts/core` and individual charts/components when bundle size
matters. It also supports custom builds. See [ECharts download/licence](https://echarts.apache.org/en/download.html)
and [importing only needed modules](https://echarts.apache.org/handbook/en/basics/import/).

Important observations:

- **No paid runtime tier is required.** The value is ecosystem, capability breadth, and adoption.
- **The package architecture makes bundle size a consumer choice.** Full import is easy; modular import
  is available for production optimization.
- **The licence and distribution are straightforward.** There is no account, payment, or runtime key
  in the chart package.

**Lesson for Defence-Charts:** keep the Free path as easy as `npm install` and make advanced modules
optional. Our `ChartPlan` and planned subpath exports can deliver stronger semantic adaptation than an
option/configuration-only engine while retaining similar installation simplicity.

### 2.7 shadcn/ui and Recharts — copy-owned composition rather than a paid chart engine

shadcn/ui’s chart documentation explicitly composes Recharts rather than wrapping it into an opaque
chart abstraction. Its `ChartContainer`, `ChartConfig`, scoped CSS variables, tooltip content, and
legend content provide a coherent shell while the consumer still assembles the underlying Recharts
primitives. See [shadcn Chart](https://ui.shadcn.com/docs/components/radix/chart) and the
[source implementation](https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/new-york-v4/ui/chart.tsx).

Recharts owns responsive measurement through `ResponsiveContainer`; the parent must provide a
measurable height, min-height, or aspect ratio. See [ResponsiveContainer](https://recharts.github.io/en-US/api/ResponsiveContainer/)
and [sizing guidance](https://recharts.github.io/en-US/guide/sizes/).

Important observations:

- **The wrapper owns presentation, not chart semantics.** Data shaping, chart choice, loading/error
  states, and dashboard persistence remain with the application.
- **Source ownership is a product feature.** Copying the component into the application makes deep
  customization easy and avoids a large runtime abstraction.
- **The responsive contract is explicit.** A chart needs a positive parent dimension; a wrapper does
  not magically fix a collapsed flex/grid ancestor.

**Lesson for Defence-Charts:** create a thin composition layer above our stable renderer: typed series
metadata, chart-local CSS variables, tooltip/legend adapters, and a WidgetGrid shell. Preserve our
stronger pure planner and RSC path underneath rather than replacing it with Recharts.

### 2.8 Recharts — the closest React-first chart comparator

Recharts is an important comparator because it solves the immediate React chart-rendering problem
better than our current repository does. Its official README describes a React + D3 library built
around native SVG, declarative components, and independent chart children. A line chart is assembled
from `LineChart`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`, and `Line` components rather than
being generated from a separate plan object. See the [Recharts repository README](https://github.com/recharts/recharts).

#### What Recharts does well

- **Immediate developer ergonomics:** install `recharts` and `react-is`, then compose JSX components.
- **Broad chart coverage:** the public source exports line, bar, pie, treemap, Sankey, radar, scatter,
  area, radial bar, composed, sunburst, funnel, and related primitives. See the
  [Recharts public exports](https://github.com/recharts/recharts/blob/main/src/index.ts).
- **Independent composition:** axes, grid, tooltip, legend, brush, labels, series, and shapes are
  separate React components and can be combined or replaced.
- **Responsive sizing:** `ResponsiveContainer` uses `ResizeObserver`; newer Recharts releases also
  support a `responsive` prop on chart components. A parent must still provide a usable width/height
  or aspect ratio. See [ResponsiveContainer](https://recharts.github.io/en-US/api/ResponsiveContainer/)
  and the [chart size guide](https://recharts.github.io/en-US/guide/sizes/).
- **Accessibility:** Recharts 3 enables `accessibilityLayer` by default and documents keyboard and
  screen-reader behavior across supported chart types. See the
  [official accessibility story](https://github.com/recharts/recharts/blob/main/storybook/stories/API/Accessibility.mdx).
- **Performance guidance:** the project documents component isolation, stable prop/dataKey
  references, memoization, throttled pointer updates, and aggregation/sampling for very large data.
  See [Recharts performance guidance](https://recharts.github.io/en-US/guide/performance/).
- **Release/package discipline:** the current package metadata declares `sideEffects: false`, publishes
  CJS, ESM, UMD, and type outputs, and declares React/React DOM/React-Is peer dependencies. The
  development guide describes build-output checks, unit tests, visual-regression tests, and Storybook.
  See [Recharts package.json](https://github.com/recharts/recharts/blob/main/package.json) and
  [DEVELOPING.md](https://github.com/recharts/recharts/blob/main/DEVELOPING.md).
- **Clear open-source boundary:** the repository is MIT-licensed and has no official Pro runtime tier
  in the reviewed sources.

#### Important Recharts caveat

The GitHub `main` branch and the published release branch are not identical: the repository states
that `main` is active development while the latest release and Storybook reflect the `release` branch.
The current `main` package metadata is therefore useful for architecture signals but should not be
treated as the exact stable npm package contract without checking the release tag.

### 2.9 Radix, Nivo, Tremor, and TanStack — composable package boundaries

These projects are useful because they show how an ecosystem can stay modular without creating a
large runtime entitlement system:

- **Radix** uses headless, independently composable primitives and documents per-primitive package
  imports/tree-shaking. See [Radix getting started](https://www.radix-ui.com/primitives/docs/overview/getting-started),
  [Radix releases](https://www.radix-ui.com/primitives/docs/overview/releases), and the
  [package exports](https://github.com/radix-ui/primitives/blob/main/packages/react/radix-ui/package.json).
- **Nivo** publishes chart-family packages such as `@nivo/bar` alongside core packages. See the
  [Nivo repository](https://github.com/plouc/nivo) and the
  [`@nivo/bar` package metadata](https://github.com/plouc/nivo/blob/master/packages/bar/package.json).
- **Tremor** offers both a public package and an editable Raw/copy-oriented component model. See
  [Tremor’s distribution model](https://www.tremor.so/docs/getting-started/about), the
  [Tremor npm package](https://www.npmjs.com/package/%40tremor/react), and its
  [Apache-2.0 repository](https://github.com/tremorlabs/tremor).
- **TanStack** separates framework-agnostic core from adapters and treats features as explicit
  opt-in capabilities. See [TanStack Table installation](https://tanstack.com/table/v8/docs/installation),
  [headless table ownership](https://tanstack.com/table/latest/docs/guide/tables), and
  [feature architecture](https://tanstack.com/table/latest/docs/guide/features).
- **shadcn registries** support both public resources and authenticated namespaces, which is a useful
  model for premium templates or blocks without putting licence code into the runtime. See
  [custom registries](https://ui.shadcn.com/docs/registry) and
  [registry authentication](https://ui.shadcn.com/docs/registry/authentication).

**Lesson for Defence-Charts:** use explicit subpath exports for chart families and Pro features;
consider per-family packages only when bundle measurements justify separate versioning. Use a
shadcn-style authenticated registry only for premium dashboard blocks/templates, not as the primary
delivery mechanism for the core chart renderer.

## Recharts versus Defence-Charts

These are not yet equivalent products. Recharts is a ready, broad React chart renderer; Defence-Charts
is a pure responsive-planning architecture with a partially implemented renderer and an unfinished
grid. The comparison should guide our next implementation decisions rather than become a reason to
replace the current core.

| Dimension | Recharts | Defence-Charts today | Decision for us |
|---|---|---|---|
| Primary abstraction | Declarative React component tree: chart container plus child axes, marks, tooltip, legend, and grid | `DataShape + SizeContext + Policy + Overrides → ChartPlan → Chart` | Keep the plan-first core; add a more approachable composition layer on top |
| Chart breadth | Broad catalogue already exported, including bar, pie, Sankey, scatter, radar, treemap, sunburst, funnel, and composed charts | Ten built-in names declared, but only line/area currently resolve; unsupported marks throw | Recharts is ahead on breadth; implement Free families incrementally before Pro families |
| Responsive behavior | Measures parent with `ResizeObserver` through `ResponsiveContainer`; newer versions also accept `responsive` | `AutoChart` measures with our observer seam and calls the same pure planner; static `<Chart>` can render from an explicit plan | Keep our measurement boundary, but add a `ChartContainer`-style sizing contract with explicit height/aspect guidance |
| Size adaptation | Primarily resizes the composed chart; callers choose chart children and props | Planner can replace marks, axes, labels, legend/table, and value treatment at size boundaries | This is our main differentiator; preserve and test it rather than reducing to CSS scaling |
| Grid integration | Works inside CSS grid/flex when the parent has a measurable size; no dashboard grid product | `@gx/grid` is intended to own 12-column placement/resize but is currently a stub | Implement the grid as Free product infrastructure and pass real pixel/grid geometry to charts |
| Rendering boundary | React-first SVG component runtime | DOM-free `@gx/core`, RSC-safe SVG primitives, client-only measurement in `@gx/react` | Preserve the server/client split; do not make core React-dependent |
| Data contract | Components receive data arrays and `dataKey` accessors directly | Core planner receives shape metadata; frame/data rendering contracts are separate | Add a documented data adapter and stable series metadata so the API is easier without moving raw data into the planner |
| Accessibility | `accessibilityLayer` is enabled by default in Recharts 3 and supports keyboard/screen-reader chart navigation | Current static path has accessible SVG/table foundations; interactive tooltip/legend/keyboard contracts are incomplete | Match Recharts’ basic interactive accessibility in Free before Pro work |
| Interaction model | Tooltip, legend, brush, labels, reference elements, and events are composable child components | `@gx/react` currently exports only `AutoChart` and `useElementSize` despite its description advertising more | Build `ChartConfig`, `ChartTooltip`, `ChartLegend`, and controlled interaction contracts as Free composition APIs |
| Typography/theming | Props, SVG attributes, CSS, and consumer composition; no repository-wide adaptive typography policy | Typed token source, generated typography/theme CSS, provenance, and planner typography budgets | Keep our token discipline and add Recharts-like per-series semantic metadata |
| Server rendering | Static dimensions can render; responsive measurement needs a measurable client parent | Static `<Chart plan={...}>` is designed for RSC/no client JS; `AutoChart` is the client path | Keep RSC as a first-class differentiator and document static versus adaptive usage clearly |
| Bundle strategy | `sideEffects:false`, CJS/ESM/UMD/types, React/React DOM/React-Is peers, and build-output/tree-shake tests | ESM-only by decision, `sideEffects` declarations, tsdown, but current package exports/CSS publication are broken | Keep ESM-only unless consumer evidence forces more formats; adopt packed-tarball, CSS, and tree-shake fixtures inspired by Recharts |
| Testing/release discipline | Unit tests, visual regression, Storybook, build-output checks, export tests, and treeshake tests are documented | Strong current line/area tests and gates; no real grid suite, external consumer fixture, or valid published CSS/tarball contract | Add the missing package and grid gates before claiming library reliability |
| Monetization | MIT, no official Pro runtime tier found in reviewed sources | Planned open core plus separate Pro/Enterprise packages | Use Recharts as a Free adoption/reference baseline, not as a paid-tier model |

### What we should borrow from Recharts

1. **Composition ergonomics:** expose independently composable `ChartContainer`, `ChartConfig`,
   `ChartTooltip`, `ChartLegend`, axes, and mark components around our plan/render contracts.
2. **Clear sizing documentation:** require a measurable width/height or aspect ratio and explain flex,
   grid, hidden tabs, and zero-size parents.
3. **Free basic accessibility:** treat keyboard navigation, screen-reader summaries, tooltip semantics,
   and legend behavior as standard library functionality.
4. **Stable public package contract:** use explicit built outputs, peer dependencies, `sideEffects`,
   package files, export tests, visual regression, and treeshake checks.
5. **Performance guidance:** document stable data/formatter references, component isolation, pointer
   throttling, data aggregation, and the supported SVG point budget.

### What we should not borrow

- Do not replace the pure `ChartPlan` with a React child tree as the source of responsive decisions.
- Do not make chart adaptation depend only on parent resizing; our product promise is information
  transformation at size boundaries.
- Do not make `@gx/core` depend on React or the DOM.
- Do not copy Recharts’ entire runtime dependency surface into the core package.
- Do not claim chart breadth parity until our planners, marks, accessibility, and browser tests exist.

### Practical integration decision

Do not add Recharts as a dependency of the core library. If we need compatibility for consumers who
already use Recharts, provide an optional adapter or document how Recharts can sit inside `@gx/grid`
using the grid’s measured box. The default Defence-Charts renderer should remain project-owned so the
responsive ladder, RSC path, typography tokens, and future Pro renderer contract stay coherent.

## 3. Pattern comparison

| Vendor/model | Free model | Paid model | Access/enforcement | Best lesson | What not to copy |
|---|---|---|---|---|---|
| MUI X | MIT Community, free forever | Pro/Premium sibling packages | Commercial key, warnings/watermark, licence terms | Clear sibling package upgrade path | Browser key as a requirement for the core renderer |
| AG Grid / AG Charts | Community production use | Enterprise sibling package | Commercial key, warnings/watermark, module registration | Separate packages plus feature modules | Global registration if it becomes our renderer’s mutable state |
| Highcharts | Evaluation/non-commercial paths | Broad commercial production licence | Legal licence and product bundles | Mature product/licence boundary and module bundles | Requiring commercial licensing before a new Free ecosystem exists |
| KendoReact | 50+ free components in a non-open suite | Premium features and source/support | Offline key file, warnings/watermarks | Offline CI-friendly activation and perpetual-version semantics | Mixing Free and paid behavior in one component surface at first |
| Syncfusion | Eligibility-based Community licence | Commercial suite | Required licence key and runtime notice | Per-developer/no-runtime-fee commercial model | Organization-size gate for Free |
| ECharts | Apache-2.0 | No paid runtime tier | Public npm and custom builds | Simple install plus modular imports | No direct support/enterprise monetization by itself |
| shadcn/Recharts | Open composition/source ownership | No required paid chart runtime | Consumer owns copied source | Thin semantic/presentation adapters | Assuming a wrapper solves chart policy or grid persistence |

## 4. What this means for our package graph

### 4.1 Current package graph

The repository’s intended graph is:

```text
@gx/tokens ───────────────┐
                          v
@gx/core ───────────▶ @gx/primitives ─────────▶ @gx/react ─────▶ @gx/grid
      │                       │                         │
      └───────────────────────┴─────────────────────────┴──▶ @gx/testing
```

The design documents describe `@gx/core` as pure and DOM-free, `@gx/primitives` as hook-free/RSC-safe,
`@gx/react` as the client measurement boundary, and `@gx/grid` as the 12-column placement shell. See
[`research/20-architecture.md`](20-architecture.md).

This graph is commercially healthy because it already separates:

- semantic planning from rendering;
- server-safe rendering from client measurement;
- chart meaning from grid placement;
- visual tokens from behavior policy.

Do not insert payment, accounts, data fetching, persistence, or licensing network calls into this
graph.

### 4.2 Package-by-package audit and edition assignment

| Package | Current evidence | Target edition | Commercial action |
|---|---|---|---|
| `@gx/core` | Pure planner, data shape, policy, overrides, scales, frame math; line/area resolver only; `ChartPlan.type` is open but built-in `ChartType` and `MarkSpec` are closed | Free | Keep MIT/permissive, no licence gate, publish stable data contracts; add an immutable extension seam before Pro charts depend on it |
| `@gx/tokens` | Generated token source, CSS themes, typed tokens, provenance gates; some tokens reserved for future families; current build does not emit CSS into `dist` | Free | Keep base tokens public; publish premium themes as separate assets/package, not by withholding base typography or contrast tokens; fix CSS packaging before release |
| `@gx/primitives` | Hook-free `<Chart>`, SVG axes/marks, accessible data table; unsupported mark kinds throw | Free | Keep standard SVG renderer public; add explicit subpaths or a Pro-owned renderer for advanced marks; do not add a global registry |
| `@gx/react` | `'use client'`, `AutoChart`, `useElementSize`, SSR initial size, deadband; package description overclaims tooltip/crosshair/brush/legend | Free | Correct description or implement the advertised contracts; keep basic tooltip/legend/a11y Free; add optional advanced interaction package later |
| `@gx/grid` | Package declares RGL dependency and 12 columns, but source only exports `GRID_COLUMNS`; real layout shell is absent | Free | This is a core product promise, not Pro. Implement drag/resize/compaction/containment/keyboard and basic persistence before commercial launch |
| `@gx/testing` | Plan snapshots, fake resize observer, a11y matchers; dev-facing; `jsdom` is currently a dev dependency despite public helper usage | Free/dev | Decide whether to publish; correct runtime dependency classification or separate browser-only helpers |
| `@gx/pro-charts` | Does not exist | Pro | New sibling package for specialized chart planners/renderers; depend on public contracts only |
| `@gx/pro-export` | Does not exist | Pro | New package for deterministic PNG/PDF/print/batch export; benchmark and document font policy |
| `@gx/pro-renderer` | Does not exist | Pro | Optional package after SVG/Canvas/WebGL benchmarks show a real need |
| `@gx/pro-themes` | Does not exist | Pro | Premium typography/theme packs and adapters; verify font/icon redistribution rights |
| `@gx/cloud-client` | Does not exist | Separate hosted product | Only for hosted persistence, sharing, permissions, collaboration, or billing; never a dependency of chart rendering |

### 4.3 Current publication state

All six library packages are currently `private: true`, version `0.0.0`, and use `@gx/*` as a
placeholder scope. Their package `exports` point to `src`, while their `files` field selects `dist`.
The TypeScript build emits JavaScript/declarations, but the current tsdown entries do not emit the
CSS files referenced by the package export maps. That is suitable for a workspace prototype but not
for a public release: a clean external install would be unable to resolve the documented source/CSS
paths.

Before publication, each package needs:

1. final package name and npm scope;
2. built `dist` exports and declaration paths;
3. CSS copied/emitted into `dist` with verified style subpaths;
4. package-level licence/notice strategy;
5. `repository`, `homepage`, `bugs`, and README metadata;
6. package-level `engines` and peer dependency policy;
7. CSS side-effect and subpath export verification;
8. `npm pack --dry-run` assertions for files, licences, and exports;
9. external consumer fixture using the packed tarballs, not workspace links;
10. Changesets/versioning and changelog automation;
11. trusted publishing/provenance for public releases;
12. a clean-install test with React 19, Next/RSC, Vite, and at least one non-Next bundler;
13. a publication gate preventing private Pro artifacts from being anonymously downloadable.

## 5. Recommended Defence-Charts commercial architecture

### 5.1 Free package contract

Free should include everything needed to build a credible embedded dashboard:

- pure responsive information ladder;
- standard chart catalogue once implemented;
- line/area now, then bar, donut, KPI, scatter, heatmap, funnel, progress, and timebar;
- RSC-safe SVG output;
- accessible data table and non-color encodings;
- basic tooltip, legend, keyboard, and reduced-motion behavior;
- base Rail/Neutral themes and typed CSS token overrides;
- 12-column grid with drag, resize, compaction, containment, and keyboard semantics;
- local layout serialization and migration primitives;
- testing helpers and plan inspection;
- public documentation and examples.

Free should not be limited by chart count, end-user count, dashboard count, local renders, or a
phone-home entitlement check. If a very large dataset needs a high-performance renderer, document the
benchmark-supported SVG budget and offer an accelerator; do not silently make ordinary charts stop
working.

### 5.2 Pro package contract

Pro should add code or assets that are genuinely expensive to maintain:

- specialized chart families: Sankey, map, Gantt, candlestick, box plot, network, and advanced flow;
- PNG/PDF/print/batch export;
- optional Canvas/WebGL renderer and high-volume interaction;
- premium theme packs and design-system adapters;
- advanced annotations, linked views, cross-widget synchronization, and composition helpers;
- diagnostics and decision traces if they expose a maintained developer experience beyond the basic
  plan inspector.

The Pro package should be a sibling package with explicit imports, similar to MUI X and AG Grid. A
consumer should see the paid dependency in `package.json` rather than discover a hidden feature flag.

### 5.3 Premium/Enterprise contract

Premium/Enterprise should mainly monetize operational confidence:

- organization-wide or named developer access;
- private registry and update channels;
- SSO and domain controls;
- audit logs and security evidence;
- SBOM, provenance, vulnerability response, and release policy;
- priority support, SLA, LTS, and migration help;
- custom design-system onboarding;
- indemnification and procurement terms;
- air-gapped/offline package and signed licence delivery.

This follows the support and version-maintenance patterns visible in MUI X, AG Grid, and KendoReact,
without making the chart runtime responsible for account state.

## 6. Licence and enforcement decision

### Recommended default

Use a permissive Free licence and a separate commercial Pro licence:

```text
Free packages: MIT or Apache-2.0 after legal review
Pro packages: commercial licence
Enterprise: commercial agreement with support, security, and deployment terms
```

Do not retroactively paywall Free code. Do not require an account to render a Free chart. Do not put a
secret or provider API key in a browser bundle.

### Options compared

| Enforcement option | Strength | User friction | Fit for our architecture |
|---|---|---:|---|
| Public Pro package + legal commercial licence | Easy install; clear code boundary | Low | Good for self-serve if legal terms are the backstop |
| Private npm/registry Pro package | Strong install/update control | Medium/high | Good for controlled B2B and Enterprise; test CI setup carefully |
| Offline signed build licence | Works without network; useful for air-gapped buyers | Medium | Good optional Enterprise layer |
| Browser runtime key and watermark | Easy to implement; visible deterrent | Medium | Only optional Pro/Enterprise; conflicts with the core no-network/RSC promise |
| Hosted API entitlement check | Central revocation | High and operationally fragile | Not acceptable for local chart rendering |
| Organization-size Free eligibility | Commercial control | High | Not recommended for an open library |

KendoReact demonstrates that offline validation can work without network requests, while MUI, AG Grid,
and Syncfusion demonstrate watermark/console-warning approaches. These are useful patterns, but our
core differentiator is deterministic, server-renderable local rendering. The renderer should remain
unaware of billing.

## 7. Pro extension seam: current state and required design

### Current state

- `ChartPlan.type` already accepts an extended string label.
- `planChart()` accepts only the built-in closed `ChartType` and currently resolves line/area.
- `MarkSpec` is closed.
- `@gx/primitives` throws for bar, arc, cell, and point mark kinds not yet implemented.
- There is no safe mutable plugin registry.

### Recommended design

For the first Pro release, prefer an explicit Pro renderer:

```tsx
import { SankeyChart } from '@gx/pro-charts/sankey'

<SankeyChart data={data} size={size} theme="rail" />
```

Internally, `SankeyChart` can use a pure Pro planner and the public core data/size/policy contracts.
This keeps `@gx/core` deterministic and avoids widening the core mark union before the extension
semantics are proven.

If the single `<Chart plan={...}>` surface must render Pro marks later, introduce a typed immutable
mark-extension payload or renderer contract. Do not use `any`, import-order registration, or a global
`registerChartType()` map. The extension must remain:

- serializable;
- deterministic;
- tree-shakeable;
- explicit in imports;
- safe for server/client boundaries;
- testable without a browser where geometry permits.

## 8. Reliability audit by package

| Area | Current reliability | Evidence | Required next gate |
|---|---|---|---|
| `@gx/core` line/area planner | High for current scope | Pure plan contract, snapshot/invariant tests, no-DOM resolver | External consumer contract and versioned public API |
| `@gx/primitives` current SVG path | High for implemented marks | RSC-safe renderer, accessible table, identity tests | Standard mark coverage and export/render snapshots |
| `@gx/react` sizing boundary | Medium-high | SSR initial size, ResizeObserver seam, deadband, browser tests | Implement or remove advertised interactions; test nested grid geometry |
| `@gx/grid` | Low | Source is currently a stub | Real RGL core wrapper, constraints, keyboard, serialization, stress tests |
| Standard chart breadth | Low | `planChart()` throws for unimplemented types | One family at a time with plan/renderer/a11y/browser tests |
| Publication | Low | Private `0.0.0` packages, source exports, placeholder scope | Tarball/external-consumer/release gates |
| Commercial Pro boundary | Not implemented | No Pro packages or entitlement service | Create one Pro package only after public contracts stabilize |
| Licensing/runtime | High architectural confidence, no implementation | Existing presentational/no-network decisions | Add a no-network source/build gate and legal terms |

The strongest current asset is the pure line/area planner. The highest-value product gap is the grid.
The highest-risk commercial gap is publishing a public contract before the grid, chart breadth, and
extension seam are stable.

## 9. Prioritized action matrix

### P0 — settle before public package publication

| Action | Package/file area | Why now |
|---|---|---|
| Choose final scope/name and licence | Root metadata, all package manifests | Package and trademark decisions become expensive after release |
| Make `dist` the public export contract | All `package.json` and tsdown configs | Workspace links currently hide consumer-install failures |
| Add package-level licence/notice files | All public packages | Root `LICENSE` is not automatically a package-level notice strategy |
| Add external consumer fixture | `apps/consumer-fixture` or release tests | Verify packed tarballs, CSS, peers, ESM, and RSC behavior |
| Reconcile `@gx/react` description | `packages/react/package.json` | Do not advertise interactions not in the export surface |
| Fix `@gx/testing` dependency classification | `packages/testing/package.json` | Public helpers must declare runtime requirements correctly |
| Add no-network gate | `scripts/` and CI | Protect the “local renderer, no phone home” contract |
| Decide extension contract | `@gx/core`, `@gx/primitives`, Pro design | Paid charts must not require a breaking core rewrite |

### P1 — finish the Free product

| Action | Package | Why it is Free |
|---|---|---|
| Implement WidgetGrid | `@gx/grid` | Resizable grid is the product’s adoption surface, not a premium lock |
| Add widget chrome and semantic slots | `@gx/grid`, `@gx/react` | Needed for the BaseDash-like dashboard feel |
| Implement standard chart families | `@gx/core`, `@gx/primitives` | A complete standard catalogue makes Free credible |
| Implement basic tooltip/legend/a11y | `@gx/react`, `@gx/primitives` | Basic interaction is part of a usable chart, not paid scarcity |
| Add layout serialization/migration primitives | `@gx/grid` | Consumers need stable saved layouts before hosted persistence exists |
| Add browser grid stress matrix | tests/fixtures | Reliability depends on real drag/resize/compaction behavior |

### P2 — validate one Pro capability

Pick one paid feature with a clear value signal, preferably export or one specialized chart family.
Do not build all Pro packages at once.

1. Create `@gx/pro-charts` or `@gx/pro-export`.
2. Depend only on published Free contracts.
3. Add a commercial licence and package-access workflow.
4. Test private registry installation from a clean CI fixture.
5. Validate one paid customer workflow end to end.
6. Measure support burden and upgrade friction before adding Premium/Enterprise complexity.

## 10. What we should learn from each vendor, explicitly

```text
MUI X       = sibling paid packages + clear upgrade imports + support tiers
AG Grid     = sibling enterprise package + module-level tree-shaking + diagnostics
Highcharts  = broad product catalogue + commercial production licence + product bundles
KendoReact  = free subset + offline licence file + perpetual released-version semantics
Syncfusion  = per-developer commercial suite + eligibility-based Community licence
ECharts     = Apache-2.0 + easy npm install + custom/import-level bundle control
shadcn      = source ownership + thin composition + semantic config + local CSS variables
```

Our resulting identity should be:

```text
Defence-Charts = pure responsive planner + RSC-safe renderer + resizable grid
                 + shadcn-like composition ergonomics
                 + explicit Free/Pro package boundaries
                 + no runtime billing dependency
```

That is differentiated from:

- a Recharts/shadcn wrapper, because our planner changes information content with size;
- a Highcharts-style broad package, because our Free foundation is open and composable;
- an AG Grid-style runtime licence, because our renderer remains locally deterministic;
- an ECharts-style option engine, because `ChartPlan` makes responsive decisions inspectable and
  testable.

## 11. Remaining evidence gaps and decisions

The research is sufficient for architecture, but not for final commercial terms. Still unresolved:

- MIT versus Apache-2.0 for Free packages;
- exact copyright ownership and DCO/CLA;
- final npm scope and trademark clearance;
- Stripe versus merchant-of-record provider;
- India GST, EU VAT, US sales tax, invoicing, and payout treatment;
- public commercial Pro package versus private registry for self-serve customers;
- whether released Pro versions remain usable forever after cancellation;
- organization versus named-developer versus application licensing;
- whether export is local-only or later becomes a hosted service;
- font, icon, map, and geodata redistribution rights;
- exact standard chart catalogue and performance budgets;
- whether `@gx/testing` is public or dev-only;
- the final immutable Pro renderer contract.

Do not treat a vendor’s current plan name or price as a universal benchmark. MUI’s current docs already
show why: its pricing/licensing model is being revised, and different official pages expose different
seat/application explanations.

## 12. Primary-source ledger

### Commercial package and licensing models

- [MUI X licensing](https://mui.com/x/introduction/licensing/) — Community MIT/free forever, Pro/Premium
  package split, upgrades, trial, licence key, and developer licensing examples.
- [MUI pricing and licence models](https://mui.com/pricing/) — Pro/Premium/Enterprise packaging, support,
  perpetual versus annual maintenance, and current pricing presentation.
- [MUI 2026 pricing/licensing update](https://mui.com/blog/2026-mui-x-price-changes/) — application-based
  licensing announcement and Enterprise/support changes; time-sensitive.
- [AG Grid Community vs Enterprise](https://www.ag-grid.com/javascript-data-grid/community-vs-enterprise/) —
  production Free boundary, Enterprise features, support, watermark behavior, and licence posture.
- [AG Grid installation](https://www.ag-grid.com/javascript-data-grid/installation/) — package split and
  evaluation behavior.
- [AG Grid modules](https://www.ag-grid.com/javascript-data-grid/modules/) — module registration and
  bundle-size/tree-shaking strategy.
- [AG Grid licence installation](https://www.ag-grid.com/javascript-data-grid/license-install/) — key
  installation and visible JavaScript licensing behavior.
- [Highcharts download/licensing](https://www.highcharts.com/download/) — 40+ core chart types, product
  bundles, npm distribution, and commercial-production licence requirement.
- [Highcharts installation](https://www.highcharts.com/docs/getting-started/installation) — package/module
  imports for Core, Stock, Maps, Gantt, export, accessibility, and other optional modules.
- [KendoReact Free vs Premium](https://www.telerik.com/kendo-react-ui/components/getting-started/free-vs-premium) —
  free subset, premium breadth, trials, source access, and support.
- [KendoReact licence activation](https://www.telerik.com/kendo-react-ui/components/my-license) — offline
  key file, CI activation, warnings, and watermarks.
- [KendoReact purchasing/licensing FAQ](https://www.telerik.com/kendo-react-ui/pricing/faq) — perpetual use,
  one-year updates/support, deployment use, and offline validation.
- [Syncfusion React Charts](https://www.syncfusion.com/react-components/react-charts) — commercial chart
  product, Community licence eligibility, export, and per-developer/no-runtime-fee statements.
- [Syncfusion licensing overview](https://react.syncfusion.com/react-ui/licensing/overview/) — required
  licence-key registration and runtime licensing notice.

### Open-source and composition models

- [Apache ECharts download/licence](https://echarts.apache.org/en/download.html) — Apache-2.0, npm, custom
  builds, and signed release guidance.
- [ECharts modular import guide](https://echarts.apache.org/handbook/en/basics/import/) — full versus
  `echarts/core`/component imports for bundle control.
- [shadcn Chart documentation](https://ui.shadcn.com/docs/components/radix/chart) — composition model,
  `ChartContainer`, `ChartConfig`, tooltip, legend, and sizing contract.
- [shadcn chart source](https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/new-york-v4/ui/chart.tsx) —
  scoped CSS variables, context, and Recharts adapters.
- [Recharts repository](https://github.com/recharts/recharts) — React + D3, native SVG, declarative
  components, independent child composition, and MIT licence.
- [Recharts public exports](https://github.com/recharts/recharts/blob/main/src/index.ts) — chart families
  and primitives exposed by the library.
- [Recharts package metadata](https://github.com/recharts/recharts/blob/main/package.json) — `sideEffects`,
  `main`/`module`/`types`/`files`, peer dependencies, and build scripts.
- [Recharts ResponsiveContainer](https://recharts.github.io/en-US/api/ResponsiveContainer/) — measurement
  and responsive-container behavior.
- [Recharts chart size guide](https://recharts.github.io/en-US/guide/sizes/) — explicit parent dimensions,
  static sizing, and the newer `responsive` prop.
- [Recharts accessibility story](https://github.com/recharts/recharts/blob/main/storybook/stories/API/Accessibility.mdx) —
  `accessibilityLayer` behavior and keyboard/screen-reader interaction.
- [Recharts performance guide](https://recharts.github.io/en-US/guide/performance/) — stable references,
  component isolation, aggregation/sampling, and pointer throttling.
- [Recharts development guide](https://github.com/recharts/recharts/blob/main/DEVELOPING.md) — build outputs,
  tests, visual regression, and published package artifacts.
- [Plotly React wrapper](https://github.com/plotly/react-plotly.js/) and [Plotly.js](https://github.com/plotly/plotly.js/) —
  MIT package distribution, peer/custom-bundle model, and responsive/event behavior.
- [npm package metadata](https://docs.npmjs.com/cli/v11/configuring-npm/package-json) — `license`, `files`,
  and package metadata needed for publication.
- [npm private packages](https://docs.npmjs.com/about-private-packages/) and [package visibility/access](https://docs.npmjs.com/package-scope-access-level-and-visibility/) —
  registry access is distinct from payment entitlement.
- [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) — release authentication and
  provenance, not customer entitlement.

### Repository evidence

- [`packages/core/src/plan.ts`](../packages/core/src/plan.ts#L65-L75) — built-in chart union and open
  `ChartPlan.type` extension label.
- [`packages/core/src/plan-chart.ts`](../packages/core/src/plan-chart.ts#L33-L85) — only line/area resolve;
  unsupported types throw.
- [`packages/primitives/src/Chart.tsx`](../packages/primitives/src/Chart.tsx#L251-L262) — unsupported mark
  kinds throw.
- [`packages/react/src/index.ts`](../packages/react/src/index.ts#L44-L54) — current React exports.
- [`packages/grid/src/index.ts`](../packages/grid/src/index.ts#L1-L19) — current grid stub.
- [`research/20-architecture.md`](20-architecture.md) — intended package graph and boundaries.
- [`docs/content/docs/roadmap.mdx`](../docs/content/docs/roadmap.mdx) — current B1–B3, C, D, and E scope.
- [`research/60-commercial-model.md`](60-commercial-model.md) — payment, entitlement, and Free/Pro/Enterprise
  recommendation.
- [`research/80-shadcn-basedash-library-strategy.md`](80-shadcn-basedash-library-strategy.md) — BaseDash and
  shadcn visual/architecture research.
- [`research/81-deep-evidence-audit.md`](81-deep-evidence-audit.md) — broader responsive, grid, accessibility,
  reliability, and blind-spot audit.
