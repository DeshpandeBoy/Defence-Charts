# Deep evidence audit: responsive chart library, shadcn-style composition, and Basedash-style grids

Status: research synthesis completed 2026-08-24  
Scope: current Defence-Charts repository, shadcn/ui chart composition, Recharts sizing/accessibility behavior, Basedash public product documentation plus local bundle observations, responsive-visualization research, chart-perception research, and repository reliability gates.

Related strategy: [80-shadcn-basedash-library-strategy.md](80-shadcn-basedash-library-strategy.md)

## 1. Executive decision

The project should not replace its current core with shadcn charts or Recharts.

The strongest path is:

1. Keep the current pure ChartPlan → hook-free SVG render tree.
2. Build a shadcn-inspired composition layer around it: ChartContainer, ChartConfig, ChartTooltip, ChartLegend, CSS-variable theming, and copyable examples.
3. Finish the real widget grid as a separate client package that reports geometry but never decides chart content.
4. Make responsiveness constraint- and task-aware. A chart should change labels, ticks, summaries, marks, or aggregation when space collapses; it should not merely shrink.
5. Treat Basedash as a visual and interaction reference, not as a source of public implementation truth. Its public docs describe the product; the local bundle notes are observational evidence and must not become unqualified API promises.
6. Release only after the current line/area path and the grid path have separate reliability evidence.

This keeps the project’s most defensible differentiator—the serializable, testable responsive plan—while borrowing the best developer experience ideas from shadcn.

## 2. What was verified locally

### 2.1 Current repository snapshot

| Measurement | Result | Interpretation |
|---|---:|---|
| Non-test package/source files | 67 | Small enough for a controlled architectural change |
| Workspace TS/TSX/CSS/MDX files including tests | 141 | The project is beyond a toy prototype; broad rewrites are risky |
| Source LOC in packages, apps, and docs/src | 19,642 | The project is beyond a toy prototype; broad rewrites are risky |
| Test-named files matched by *.test.* or *.spec.* | 24 | Test infrastructure exists, but file count is not coverage |
| Baseline test run | 33 files, 671 tests passed | Strong current regression signal for implemented scope |
| Typecheck | 14 tasks passed | Type contracts are currently coherent |
| Current chart planner | line and area resolve | Remaining chart types intentionally throw until their milestone |
| Grid source | 19-line boundary stub | Grid is not yet a production feature |
| Grid dependency | react-grid-layout 2.2.4 range | Engine is selected, but the integration and version policy are not complete |

Primary local evidence:

- [00-decisions.md](00-decisions.md) lines 7–17 lock the package boundaries, pure plan, 12-column model, CSS tokens, and react-grid-layout core choice.
- [20-architecture.md](20-architecture.md) lines 10–55 define the package graph and client boundary.
- [30-implementation-plan.md](30-implementation-plan.md) lines 354–363 record B1–B3 complete for line/area, with C1–C2 grid work, D chart breadth, and E release remaining.
- [packages/core/src/plan-chart.ts](../packages/core/src/plan-chart.ts) lines 34–92 show line/area dispatch and explicit errors for unimplemented chart types.
- [packages/grid/src/index.ts](../packages/grid/src/index.ts) lines 4–19 show that the grid currently exports only GRID_COLUMNS and has no layout component.
- [packages/grid/package.json](../packages/grid/package.json) lines 17–24 show react-grid-layout 2.2.4 and React 19 peer dependencies.
- [packages/react/src/AutoChart.tsx](../packages/react/src/AutoChart.tsx) lines 4–53 and 98–183 show the measurement → pure planner → shared renderer seam.

### 2.2 Reliability gates rerun on 2026-08-24

| Gate | Result | What it proves |
|---|---|---|
| pnpm lint:tokens | PASS | 4 stylesheets clean against 222 declared tokens |
| pnpm lint:granularity | PASS | 30 knobs dispositioned; no undeclared named tokens |
| pnpm lint:api | PASS | 6 packages clean |
| pnpm lint:boundary | PASS | client boundary restricted to @gx/react and @gx/grid |
| pnpm lint:rsc | PASS | 77 SVG marks server-rendered; no chart-marker leakage into client bundle |
| pnpm lint:motion | PASS | chart transitions observed in Chromium; reduced-motion path sampled |
| pnpm lint:containment | PASS | 178 sizes, 13 rung changes, 0 ResizeObserver loop errors, 0 unattributed overflow |
| pnpm typecheck | PASS in baseline run | workspace TypeScript contracts compile |
| pnpm build | PASS, 9 tasks | packages, playground, RSC fixture, and docs build under the current environment |
| pnpm test | PASS in baseline run | 671 tests pass across 33 files |
| pnpm lint:policy | ENVIRONMENT BLOCK | Node 22.12.0 is below the repository requirement of >=22.18; the script also imports a TypeScript source file directly |

The policy row is an environment-floor finding, not a current code failure: the same gate and the
full test suite pass under supported Node 24 in `research/handoffs/P0.1.md` and the P0.2
reconciliation. Release verification must continue to use Node `>=22.18`.

Important qualification: passing gates prove the implemented line/area scope and its test fixtures. They do not prove the unfinished grid, future chart types, consumer CSS combinations, or production-scale dashboards.

## 3. Research method and evidence grades

The report separates facts from recommendations.

- A-lit: peer-reviewed perception research or a normative W3C accessibility requirement.
- A-impl: official source or documentation for a shipped library.
- B-local: a directly measured repository or local bundle fact.
- C-inference: a design recommendation derived from the evidence, not independently proven.

Confidence means confidence in the stated claim, not confidence that the proposed library will automatically deliver the outcome.

## 4. Claim-to-source ledger

| Claim | Evidence | Confidence | What it supports | What it does not support |
|---|---|---|---|---|
| Responsive visualization needs content/layout transformations, not only CSS scaling | Kim, Moritz, Hullman catalogued 378 large/small visualization pairs and 76 responsive strategies; the paper describes trade-offs between density and message preservation | High for the descriptive taxonomy; medium for any individual strategy | A planned adaptation ladder with explicit transformations | A universal best breakpoint or a guarantee that every transformation improves comprehension |
| Breakpoints should evaluate visualization constraints | Schöttler et al. describe constraint-based breakpoints using element size, overlap, aspect ratio, and available space across bar, scatter, heatmap, map, network, and other visualizations | High | Data-shape- and geometry-aware breakpoint rules | A claim that their exact constraints or thresholds should be copied into this library |
| 24 px and 80 px are useful reference points, not universal chart minimums | Heer et al. tested chart heights in separate tasks. Sizing the Horizon found a 24 px speed/accuracy optimum for specified line and horizon tasks; Heer and Bostock found 40 px worse than larger heights and little benefit beyond 80 px for a bounded 0–100 comparison task | High for those experiments; medium for generalization | A threshold-validation test matrix and conservative fallback behavior | A universal minimum height, font-readability rule, or guarantee for every chart type |
| Gridline spacing affects comparison accuracy | Heer and Bostock’s 2,880-response experiment found significant effects for chart height, gridline spacing, and their interaction; the paper suggests at least 8 px between gridlines for the tested task | High for the tested task | Avoid dense gridlines and test plot-area pixel spacing | A universal 8 px rule for every device, label system, or task |
| Animation can help when mapping related views, but timing and staging matter | Heer and Robertson ran two controlled experiments; tested transitions included 1.25-second and 2-second durations, and the paper reports improved graphical perception for appropriately designed transitions. Axis rescaling and heavy staging could increase errors | High for tested transitions | Stable domains, semantic continuity, reduced-motion handling, targeted animation | A universal duration, autoplay policy, or proof that animation always improves comprehension |
| Essential graph objects need sufficient contrast | WCAG 2.2 and its non-text-contrast guidance identify important lines and shapes in graphs as graphical objects; essential objects have a 3:1 contrast requirement under the relevant criterion | High as a conformance target | Token validation and redundant encodings | A WCAG pass does not prove color-vision-safe interpretation or comprehension |
| Complex charts need a nonvisual alternative | W3C WAI guidance recommends a short identification plus a longer description for complex images, and structured tables with header relationships | High as implementation guidance | Chart title, description, data table, and trend summary contracts | A table alone is not guaranteed to preserve every visual insight |
| Graphics semantics require more than static visual styling | WAI-ARIA Graphics describes structured graphics semantics and explicitly states interactive accessibility cannot be confirmed by static checks alone | High | Keyboard, screen-reader, and interaction tests in addition to DOM snapshots | A role attribute alone makes a chart accessible |
| shadcn charts are a composition pattern, not a chart abstraction | Official shadcn source wraps Recharts ResponsiveContainer, provides ChartConfig, scoped CSS variables, tooltip/legend content, and a client boundary; its docs describe the relationship as composition | High | A compatible UI layer around our renderer | A reason to move the pure planner into React or to use Recharts as the responsive decision engine |
| Recharts still requires a positive sizing contract | Official Recharts source/API uses ResizeObserver and withholds child rendering when calculated dimensions are non-positive; the parent needs a usable width/height or aspect ratio | High | A required height/aspect contract and containment guidance | A generic responsive wrapper fixes auto-height loops or collapsed flex/grid ancestors |
| react-grid-layout supplies layout primitives, not product semantics | Its official README documents responsive layouts, serialization, resize/drag, constraints, compaction, and a framework-agnostic core | High | Use RGL core for collisions/compaction and own widget semantics | RGL automatically supplies Basedash’s typography, chart adaptation, accessibility, or persistence policy |
| Basedash’s public product behavior is a valid UX reference | Basedash docs publicly describe chart selection, dashboard drag/resize, sharing, embedding, and permissions | High for public product claims | Compare user-facing capabilities and interaction goals | Public docs do not disclose the private renderer, exact breakpoints, token values, or internal chart algorithm |
| Local Basedash bundle observations are implementation evidence | research/raw/02-basedash-grid-model.md records extracted bundle behavior and caveats | Medium for the observed artifact; low for generality | Use as hypotheses for our own experiments | Treating observed private behavior as an official Basedash contract |

## 5. What the primary research changes in our design

### 5.1 Replace universal pixel rules with constraint families

The current size classes are useful as a stable vocabulary, but the class alone cannot be the whole decision. Each rung should be selected by:

- available width and height;
- grid footprint;
- number of series and points;
- label length and estimated advance;
- temporal versus categorical axis;
- whether a legend, data labels, annotations, or a table are required;
- minimum mark and gap sizes;
- task priority: trend, comparison, ranking, distribution, or exact value lookup.

The implementation should keep a discrete ladder because discrete outputs are testable and visually stable. The ladder should be entered by constraints, not by a single hard-coded chart-height claim.

Recommended rule shape:

~~~text
if required plot width < minimum for the current encoding:
  remove or transform the lowest-priority visual layer
if required label/gap budget fails:
  reduce ticks, abbreviate, rotate, or move to a table
if mark count remains above the encoding capacity:
  aggregate, facet, or substitute the encoding
if no legible visual plan remains:
  show a compact summary plus an accessible table
~~~

This is aligned with the current ChartPlan approach. It is not evidence that the current thresholds are optimal; those still need experiments.

### 5.2 Keep chart-plan purity

The repository’s strongest architecture is already the right foundation:

~~~text
size + data shape + overrides
  -> pure planChart()
  -> serializable ChartPlan
  -> hook-free Chart
  -> SVG
~~~

The browser layer should only:

- observe a container;
- convert the box into SizeContext;
- retain deadband state;
- call the pure planner;
- render the shared plan.

It should not fetch data, decide chart type, read DOM text metrics, or maintain a second responsive rule system.

### 5.3 Add a shadcn-like surface without copying its internals

Build these public pieces around the current renderer:

| Proposed surface | Responsibility | Must not own |
|---|---|---|
| ChartContainer | width/height/aspect/containment contract, chart id, theme scope, initial SSR dimension | chart semantics or data fetching |
| ChartConfig | labels, icons, semantic color roles, light/dark values, formatter references | chart data, breakpoint rules, raw SVG |
| Chart | hook-free rendering of a supplied ChartPlan | ResizeObserver |
| AutoChart | client measurement and planner invocation | chart-specific layout logic |
| ChartTooltip | HTML tooltip composition and keyboard/live-region behavior | geometry decisions |
| ChartLegend | series naming, toggling, responsive placement | chart data transformation |
| ChartDataTable | structured alternative for exact values and relationships | visual styling |
| WidgetGrid | layout, drag/resize, persistence, keyboard/focus shell | deciding which marks or labels a chart shows |

Use names and ergonomics that feel familiar to shadcn users, but do not claim drop-in compatibility with shadcn/Recharts examples.

## 6. shadcn and Recharts: exact findings

The official shadcn source inspected by the research agent shows:

- ChartContainer is a client component.
- ChartConfig is a typed map of label/icon and color or light/dark theme values.
- ChartConfig does not contain chart data or data keys.
- ChartContainer wraps Recharts rather than replacing it with a higher-level grammar.
- CSS variables are scoped per chart instance.
- The current source passes an initial 320 × 200 dimension to ResponsiveContainer.
- A usable CSS height, min-height, or aspect ratio is still required.
- ChartTooltip aliases Recharts Tooltip; ChartTooltipContent is the shadcn-specific layer.
- Recharts 3 accessibilityLayer provides a chart-level keyboard stop and screen-reader behavior, but custom content still needs testing.

Version warning: the agent’s official-source pass found shadcn’s current v4 app pinned to Recharts 3.8.0 while current Recharts repository material reports a later stable source. Any compatibility decision must pin and test a specific version; “shadcn chart behavior” is not a timeless API.

Decision: copy the composition contract and theming ergonomics, not the Recharts dependency or its sizing semantics.

## 7. Basedash: what is solid and what is not

### 7.1 Publicly supported

Basedash public documentation supports these product-level observations:

- dashboards contain draggable/resizable blocks;
- dashboards can be shared and embedded;
- permissions distinguish viewers and editors;
- charts are selected and configured around data/query intent;
- chart types include line, bar, area, pie/donut, scatter, funnel, and KPI-like displays;
- customization includes visual and data-oriented choices.

Sources:

- [Basedash dashboards](https://www.basedash.com/docs/features/dashboards)
- [Basedash charts](https://www.basedash.com/docs/features/charts)
- [Basedash embedding](https://www.basedash.com/features/embedding)

These are useful UX requirements, not source-code specifications.

### 7.2 Local bundle observations

The previous local research recorded these observations in [raw/02-basedash-grid-model.md](raw/02-basedash-grid-model.md):

- 6/12/18 column regimes for normal/wide/ultrawide layouts;
- approximately 140 px minimum column width;
- approximately 200 px base unit;
- approximately 188 px row height;
- approximately 12 px gutters and container padding;
- a single-column mode below roughly 480 px;
- react-grid-layout behavior including vertical compaction, no overlap, push-down, and unbounded rows;
- four corner resize handles;
- line-chart behavior that hides axes at very small widths and exposes line-end values only at large widths;
- tick-density logic that estimates label width and preserves first/last ticks;
- light/dark CSS variable layers;
- visx-related classes and measured-parent-size utilities in the bundle.

The parallel bundle audit added two useful checks:

- the public chart bundle currently dispatches roughly 17 API families, including table, line,
  vertical/horizontal bar, scatter, funnel, number, progress, image, record, text, pie, activity,
  map, sankey, and dashboard-header/text variants;
- responsive branches include axis hiding around 200 px, line-end values above 800 px, funnel totals
  below 400 px, horizontal-bar totals below 600 px width or 200 px height, and pie legend placement
  based on aspect ratio.

These observations are linked to the public bundle artifacts used in the audit:

- [dashboard grid sizing bundle](https://charts.basedash.com/assets/dashboardGridSizing-DU-oG3qo.js)
- [chart bundle](https://charts.basedash.com/assets/Chart-BKklEj5s.js)
- [responsive-layout changelog](https://www.basedash.com/changelog/2026-01-23)

Confidence: these are local artifacts observed in a particular public build, not a guarantee of current Basedash internals. They are good hypotheses for experiments and poor foundations for claims such as “Basedash’s API is 6/12/18 columns.”

### 7.3 What we should borrow

Borrow the product intent:

- widgets feel like movable analytical objects;
- the grid makes resizing direct and predictable;
- charts have strong default typography and restrained chrome;
- the chart changes its information density as it becomes small;
- embedding and reuse are treated as first-class outcomes.

Do not borrow without revalidation:

- exact pixel thresholds;
- exact breakpoints;
- exact row-height math;
- private CSS variable names;
- private chart library internals;
- any assumption that the public application’s behavior is stable across releases.

## 8. Reliability assessment

| Area | Current confidence | Reason |
|---|---|---|
| Pure line/area planner | High | Pure resolver, explicit contracts, snapshot/invariant/stability tests, RSC and browser gates |
| CSS token and presentation discipline | High | Token, granularity, boundary, and API gates pass |
| SVG server rendering | High for current fixtures | RSC gate observes 77 marks and no chart-marker leakage |
| Resize containment | High for tested sizes | 178-size browser sweep, 13 rung changes, 0 loop errors |
| Motion behavior | High for current line/area transition | Chromium gate observes staging, frame progression, and reduced-motion |
| shadcn-style wrapper proposal | Medium-high | Thin composition layer maps naturally to existing package split |
| Widget grid today | Low | @gx/grid is currently a boundary stub |
| Grid after C1/C2 | Medium initially; high after browser/persistence/keyboard tests | RGL handles low-level layout, but product semantics remain ours |
| Future bars, donuts, scatter, KPI, heatmap | Low today | Planner explicitly throws for these types |
| Basedash visual fidelity | Medium as a reference; low as a guarantee | Public docs and local bundle observations are not full source |
| Universal “reliable chart at any size” claim | Not supported | Research supports task-specific constraints and experiments, not a universal guarantee |

The correct public claim today is:

> The current line/area path has strong tested invariants and a pure responsive-plan architecture. The grid and broader chart library are still under implementation and need their own validation.

## 9. Prioritized change plan

### P0 — complete the foundation before visual expansion

1. Implement WidgetGrid around react-grid-layout core.
   - responsive layouts;
   - explicit 12-column baseline;
   - serialized layout schema with version;
   - min/max width and height;
   - no-overlap/push/compaction policy;
   - four-corner resize handles;
   - layout change callback;
   - keyboard and focus semantics;
   - container measurement seam;
   - deterministic initial layout for SSR/hydration.

2. Pin the grid engine.
   - Replace the caret range with a deliberate exact version or workspace override.
   - Record the tested RGL version in the grid package docs.
   - Run the grid’s collision, compaction, bounds, resize, and serialization tests against that version.

3. Add ChartContainer and ChartConfig.
   - Make the explicit size contract visible.
   - Scope CSS variables per instance.
   - Support direct colors and theme maps.
   - Keep data and responsive policy separate.
   - Preserve hook-free Chart and client-only AutoChart.

4. Close the environment gate.
   - Run policy verification under Node >=22.18.
   - Fix the policy script’s TypeScript loading path if it is still incompatible with the supported runtime.
   - Record the exact Node and pnpm versions in CI.

### P1 — make the library dependable for real applications

1. Add a formal responsive constraint model.
2. Add chart title, description, table, and long-description contracts.
3. Add keyboard/focus/tooltip tests using real browser semantics.
4. Add contrast and color-redundancy fixtures, including non-text graph objects.
5. Add label/tick collision tests with synthetic font metrics.
6. Add grid benchmarks for 1, 10, 50, 100, and 200 widgets.
7. Add layout persistence and migration tests.
8. Add consumer examples for plain React, Next.js RSC, and a non-Next bundler.

### P2 — expand chart breadth

Implement one chart family at a time, with a complete planner + renderer + accessibility + browser test fixture:

- bar/timebar;
- KPI/progress;
- donut;
- scatter;
- heatmap;
- funnel.

Do not add chart types by adding renderer-only components. The planner must have an explicit plan for each type at each supported size class.

## 10. Experiment backlog: turn recommendations into data

The following experiments are more valuable than arguing over copied thresholds.

### E1. Height and task matrix

For line, bar, area, and KPI cards, test 24, 40, 80, 120, 160, and 240 CSS px at representative widths.

Tasks:

- trend direction;
- nearest-value comparison;
- exact lookup;
- ranking;
- anomaly detection.

Measure:

- error;
- completion time;
- abandonment;
- tooltip/table reliance;
- label collision count.

Output: chart-family- and task-specific minimums, not one global minimum.

### E2. Constraint breakpoint matrix

Sweep width, height, point count, series count, label length, and legend size. For each fixture record:

- selected size class;
- visible axes/ticks;
- mark count;
- aggregation/faceting;
- label collision result;
- table/summary fallback;
- whether the layout is stable when swept up and down.

Output: a machine-readable breakpoint corpus that feeds both policy tests and docs.

### E3. Grid stress matrix

Measure drag/resize latency, collision correctness, and layout stability at 1, 10, 50, 100, and 200 widgets across 6/12/18-column regimes.

Include:

- repeated resize;
- cross-breakpoint persistence;
- add/remove;
- static widgets;
- min/max constraints;
- keyboard movement;
- reduced motion;
- hydration with saved layouts.

Output: performance budgets and supported widget counts.

### E4. Typography and tick legibility

Use the actual tokenized type scale and representative fonts. Test:

- long category labels;
- date/time labels;
- compact numeric formats;
- duplicate formatted values;
- first/last tick retention;
- rotated versus abbreviated labels;
- gridline spacing.

Output: a label solver contract with measured fixtures, not visual intuition alone.

### E5. Accessibility task test

Test with keyboard and at least one screen reader/browser combination:

- entering and leaving a chart;
- navigating points or summaries;
- understanding the title and description;
- reading the data table;
- identifying series without color;
- reading live tooltip updates;
- reaching resize/drag controls;
- using the same dashboard with reduced motion.

Output: interaction requirements and a documented fallback when chart-level semantic navigation is unavailable.

## 11. Estimated delivery

These are engineering estimates based on the measured repository state, not research findings.

| Workstream | Estimate | Depends on |
|---|---:|---|
| Real WidgetGrid seam and basic RGL integration | 2–4 days | C1 API decision |
| Responsive layouts, constraints, persistence, serialization | 3–5 days | grid seam |
| Grid browser/keyboard/stress coverage | 3–5 days | working grid |
| ChartContainer/ChartConfig/tooltip/legend composition layer | 2–4 days | current primitives |
| Accessibility contract and data-table fallback | 2–4 days | chart surface |
| First additional chart family | 2–4 days each | planner + renderer conventions |
| Consumer examples and packaging/release hygiene | 2–4 days | stable public API |

A focused foundation pass is roughly 1.5–2 weeks for one engineer. A credible reusable library with the first four chart families, production grid behavior, and release-level verification is roughly 4–7 weeks. These ranges assume no redesign of the current core, no data-fetching layer, and no hidden product requirements.

Reliability should be described as a staged property:

- now: high for the implemented line/area path;
- after grid P0/P1: credible for dashboard use;
- after chart breadth and accessibility experiments: suitable for a reusable public library;
- never: an unconditional promise that every arbitrary dataset is legible at every arbitrary size.

## 12. Open gaps and research limits

1. Basedash is closed source. The local bundle observations are not a complete or stable implementation reference.
2. Peer-reviewed responsive-visualization research does not validate our exact six size classes or token values.
3. The chart-height studies use specific tasks, chart types, participant pools, and display contexts.
4. WCAG contrast compliance does not establish color-vision-safe chart semantics by itself.
5. RGL’s official feature list does not prove our proposed grid API, performance budget, or keyboard behavior.
6. Current browser gates cover current fixtures, not all consumers’ flex, grid, overflow, transforms, or container-query combinations.
7. The repository's local Node 22.12.0 reproduces a policy-gate loader failure, while supported
   Node 24 passes it; this is an environment-floor limitation, not evidence that the gate is broken.
   Release CI must run Node `>=22.18`.
8. The current package description for @gx/react mentions tooltip, crosshair, brush, and legend interaction, but the source inventory should be reconciled before presenting all of those as shipped public features.

## 13. Source register

Primary research and standards:

- [Sizing the Horizon: The Effects of Chart Size and Layering on the Graphical Perception of Time Series Visualizations](https://idl.uw.edu/papers/horizon)
- [Crowdsourcing Graphical Perception: Using Mechanical Turk to Assess Visualization Design](https://homes.cs.washington.edu/~jheer/files/2010-MTurk-CHI.pdf)
- [Animated Transitions in Statistical Data Graphics](https://doi.org/10.1109/TVCG.2007.70539)
- [Design Patterns and Trade-Offs in Responsive Visualization for Communication](https://doi.org/10.1111/cgf.14321)
- [Constraint-Based Breakpoints for Responsive Visualization Design and Development](https://openaccess.city.ac.uk/id/eprint/33322/)
- [Effects of Screen-Responsive Visualization on Data Comprehension](https://doi.org/10.1177/14738716211038614)
- [Using Patterns to Encode Color Information for Dichromats](https://doi.org/10.1109/TVCG.2012.93)
- [Rich Screen Reader Experiences for Accessible Data Visualization](https://doi.org/10.1111/cgf.14519)
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [Understanding WCAG 2.2 Success Criterion 1.4.11: Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast)
- [WAI Complex Images Tutorial](https://www.w3.org/WAI/tutorials/images/complex/)
- [WAI Tables Tutorial](https://www.w3.org/WAI/tutorials/tables/)
- [WAI-ARIA Graphics Module](https://www.w3.org/TR/graphics-aria-1.0/)

Official implementation sources:

- [shadcn/ui Chart documentation](https://ui.shadcn.com/docs/components/base/chart)
- [shadcn/ui chart source](https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/new-york-v4/ui/chart.tsx)
- [Recharts ResponsiveContainer API](https://recharts.github.io/en-US/api/ResponsiveContainer/)
- [Recharts sizing guide](https://recharts.github.io/en-US/guide/sizes/)
- [Recharts accessibility source](https://github.com/recharts/recharts/blob/main/storybook/stories/API/Accessibility.mdx)
- [React-Grid-Layout official README](https://github.com/react-grid-layout/react-grid-layout)

Product/reference sources:

- [Basedash dashboards](https://www.basedash.com/docs/features/dashboards)
- [Basedash charts](https://www.basedash.com/docs/features/charts)
- [Basedash embedding](https://www.basedash.com/features/embedding)

## 14. Additional blind spots to close

The strategy document covers several of these at a planning level, but they were not explicit
enough in the evidence audit. They should be treated as library contracts, not polish.

| Blind spot | Why it matters | Minimum decision/test |
|---|---|---|
| Data-shape edge cases | Responsive planning is only as trustworthy as its handling of nulls, duplicate timestamps, unsorted points, missing categories, negative values, huge magnitudes, and mixed series lengths | Define canonical Series rules, validation behavior, sorting policy, missing-value policy, and typed diagnostics; add fixtures for each |
| Widget state semantics | Real dashboards have loading, empty, stale, partial, error, retry, and insufficient-size states; otherwise every consumer invents a different shell | Define a state machine outside @gx/core, with stable height and accessible status text; test transitions without changing chart measurement unexpectedly |
| Interaction ownership | Tooltip, legend, crosshair, brush, selection, linked highlighting, and URL/share state can conflict if both grid and chart packages own them | Document controlled/uncontrolled state, event payloads, focus ownership, and whether cross-widget coordination is an optional package |
| Large-data behavior | SVG mark count, tooltip payloads, hit-testing, and planner work can become the real bottleneck before grid layout does | Set supported point/series budgets; benchmark 1k, 10k, and 100k points; define downsampling/aggregation as an explicit consumer or core policy |
| Grid persistence and migration | A serialized layout must survive breakpoint changes, widget renames, removed widgets, schema upgrades, failed saves, and conflicting edits | Version layouts, define reconciliation rules, add migration fixtures, and specify optimistic-save/conflict behavior or explicitly remain local-only |
| Touch and input modality | A desktop drag/resize interaction can be unusable on touch, pen, keyboard, or a screen reader | Test pointer, touch, keyboard, focus-visible, escape/cancel, and resize-handle hit areas separately |
| Internationalization and RTL | Label width, number/date formatting, text direction, legend order, and grid resize handles change under locale and RTL | Make formatters and direction explicit; test long translated labels, Arabic/Hebrew layout, time zones, and locale-specific numerals |
| Print, export, and static delivery | Reports, PDFs, email, and image exports often have no ResizeObserver and need deterministic dimensions | Add print/export fixtures using the same ChartPlan, with no client measurement dependency and an explicit font-loading policy |
| Security and content trust | Tooltips, titles, descriptions, table cells, and Markdown-like widget content may receive untrusted data | Define plain-text versus trusted-render contracts, escaping rules, URL handling, and CSP expectations; test malicious labels/URLs |
| Public package compatibility | Internal workspace imports can hide missing exports, CSS ordering assumptions, peer dependency errors, and bundler incompatibilities | Add an external consumer fixture, test ESM/CJS policy explicitly, verify CSS import order, React 19 peer behavior, tree-shaking, and semver/change-log rules |
| Browser and font matrix | Pixel thresholds and text metrics can vary by browser, font availability, zoom, device pixel ratio, and forced-colors mode | Test Chromium/WebKit/Firefox where supported, 100/125/200% zoom, missing web fonts, forced colors, and high-contrast modes |
| Diagnostics and observability | A library consumer needs to understand why a chart became compact, substituted, or unavailable | Provide development diagnostics or a serializable decision trace without leaking data values; test that diagnostics are tree-shakeable or disabled in production |
| Provenance and visual imitation boundary | Reusing Basedash screenshots, CSS values, assets, or private bundle assumptions may create licensing and maintenance problems | Use Basedash for behavioral inspiration, keep original tokens/assets, record provenance, and avoid copying private names or code |
| Product boundary | Dashboard filters, query execution, caching, auth, collaboration, and AI suggestions are separate systems from a presentational chart library | Publish an explicit non-goals document and optional adapter boundaries so the core remains reusable |

The highest-priority omissions are data-shape validation, widget states, interaction ownership, large-data budgets,
layout migration, and the external consumer fixture. Without these, the library may look correct in a demo while
still being difficult to adopt safely.

## Final recommendation

Proceed with the existing architecture, finish the grid as a real product boundary, and add a shadcn-style composition layer. Do not migrate the core to Recharts. The current repository has enough evidence to justify the architecture and enough passing gates to continue, but not enough evidence to claim that the full reusable library is complete or universally reliable.

The next implementation checkpoint is C1: a tested WidgetGrid with deterministic layouts, explicit constraints, persistence, and a geometry-only contract to AutoChart.
