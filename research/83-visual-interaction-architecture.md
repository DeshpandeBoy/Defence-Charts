# 83 — Resizable chart visual and interaction architecture

**Revision:** 2026-08-24  
**Status:** research-backed future-build specification  
**Scope:** chart cards, dashboard grid behavior, filters, legends, tooltips, crosshairs, accessibility,
and visual semantics for Defence-Charts.  
**Working interpretation:** “BaseDash” in the brief refers to **Basedash**.

This document turns the previous research into a buildable visual and interaction contract. It does
not implement the components yet. It answers what the library should render, how it should react to
grid resizing, where each region belongs, how filters enter the system, and how we will know the
result is reliable.

## Executive decision

Build four cooperating layers:

```text
Dashboard state + filter state
          │
          ▼
@gx/grid: placement, drag, resize, persistence, dashboard chrome
          │  measured widget box
          ▼
@gx/core: SizeContext → ChartPlan → layout/frame/interaction intent
          │
          ├── @gx/primitives: static SVG, semantic figure, data table
          └── @gx/react: client tooltip, crosshair, legend controls, keyboard/touch state
```

The visual direction is:

- **Basedash-inspired:** dark/neutral data-first cards, quiet borders, compact titles, high signal
  density, strong value hierarchy, and more content at larger grid footprints. The supplied visual
  evidence shows the useful pattern: a restrained card shell, a small title/action row, and charts
  that spend extra space on legends, values, and context rather than merely enlarging strokes. See
  [the local medium donut reference](assets/donut-medium-total-only.jpg), [wide donut reference](assets/donut-wide-legend-other.jpg),
  and [KPI/timebar reference](assets/kpi-plus-timebar-and-number.jpg).
- **shadcn-inspired:** source-owned composition, semantic CSS variables, optional tooltip/legend
  pieces, and a shell that composes with the host application. shadcn explicitly says its chart
  component composes Recharts rather than hiding it behind an opaque abstraction; the copied source
  belongs to the consumer. See [shadcn Chart](https://ui.shadcn.com/docs/components/radix/chart) and
  the [chart source](https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/new-york-v4/ui/chart.tsx).
- **Defence-Charts-owned:** a pure, inspectable information-density ladder. A card changes marks,
  axes, labels, legend placement, tooltip mode, and data-table affordance as its own box changes.
  It must not become a CSS-scaled Recharts wrapper.

The most important boundary is this:

> Filters belong to the dashboard/data state. Tooltip and crosshair state belong to the chart
> interaction layer. Size semantics belong to `@gx/core`. None of them may resize their measured
> parent through content feedback.

## 1. Evidence and confidence model

This plan separates verified facts from decisions we are making.

| Label | Meaning | Examples |
|---|---|---|
| **Repo fact** | Directly observed in this checkout | `ChartPlan` has tooltip/legend intent; `@gx/grid` currently exports only `GRID_COLUMNS` |
| **Vendor fact** | First-party product documentation/source | Basedash exposes dashboard-level filters; Recharts documents `Tooltip` placement and `ResponsiveContainer` |
| **Artifact fact** | Observed in supplied screenshots or the shipped Basedash bundle analyzed in the research corpus | Basedash’s 6/12/18 column modes, 12px gaps, 188px nominal row/cell, and 480px single-column mode |
| **Research-backed inference** | Supported by evidence but adapted to this library | Fixed tooltips on narrow cards; external legends at large footprints |
| **Product decision** | Our intended contract | Filters collapse to a drawer at narrow dashboard widths; grid drag starts from the header, not the plot |
| **Open decision** | Must be confirmed before implementation | Whether to use an internal placement engine or a client-only Floating UI adapter |

### Current repository baseline

The existing implementation already gives us a strong foundation:

- `SizeContext` carries both grid units and measured pixels. See [`packages/core/src/context.ts`](../packages/core/src/context.ts).
- `ChartPlan` is a serialisable, complete per-rung specification with axes, marks, labels, legend,
  interaction, narrative, aggregate, data table, and motion fields. See [`packages/core/src/plan.ts`](../packages/core/src/plan.ts).
- The current interaction contract already distinguishes `none`, `tap`, and `hover`, plus fixed
  versus fluid tooltip placement. It is an intent contract, not an implemented overlay yet.
- The current static renderer is an RSC-compatible `<figure>` + SVG with `role="graphics-document"`,
  title/description, and an HTML data table inside `<figcaption>`. See [`packages/primitives/src/Chart.tsx`](../packages/primitives/src/Chart.tsx).
- `@gx/react` currently measures, plans, and renders. It does not yet provide tooltip, crosshair,
  legend controls, or filter controls. See [`packages/react/src/AutoChart.tsx`](../packages/react/src/AutoChart.tsx).
- `@gx/grid` is currently only a 12-column boundary constant. The actual grid shell, persistence,
  resize handles, and dashboard-level filter bar are future work. See [`packages/grid/src/index.ts`](../packages/grid/src/index.ts).
- `ChartFrame.PointPos` currently carries only `x`, `y`, and `value`; it does not yet retain a stable
  `seriesId`, `dataIndex`, or raw x/category identity. Null points are removed while the frame is
  built. That is acceptable for the static first rung, but it is not enough for reliable tooltip,
  keyboard, crosshair, or data-table relationships. Add stable identity before implementing those
  interactions. See [`packages/core/src/frame.ts`](../packages/core/src/frame.ts).
- The repository’s current `SizeContext` documents `cols` as `1..12`, while the Basedash evidence
  includes an 18-column ultrawide mode. Do not pass `18` into the current contract silently. Before
  shipping ultrawide layouts, either add an explicit `gridColumns`/profile field, widen the context
  contract, or defer 18-column behavior to the grid package.
- `@gx/core` resolves only the line/area rung today; unsupported mark kinds still throw in the
  primitives. This document therefore specifies the architecture for the library, while the first
  implementation slice should remain line/area plus a real grid shell.

## 2. What we are taking from Basedash

Basedash is useful as a visual and product-flow reference, not as a complete public chart API.
Its official documentation says users can resize and arrange charts, group related metrics, add
headers/text, and use dashboard-wide filters. Its chart documentation describes AI-selected chart
types, breakdowns, visual customization, legends, and formatting, but does not publish a complete
responsive layout contract. See [Basedash dashboards](https://www.basedash.com/docs/features/dashboards),
[Basedash charts](https://www.basedash.com/docs/features/charts), and [Basedash filters](https://www.basedash.com/docs/features/filters-and-variables).

The earlier bundle analysis in [`research/raw/02-basedash-grid-model.md`](raw/02-basedash-grid-model.md)
found the following artifact facts:

| Basedash behavior | What we should learn | What we should change for Defence-Charts |
|---|---|---|
| 6, 12, and 18-column dashboard modes | A dashboard may need more than one logical width profile | Keep a 12-column library primitive, but expose profiles instead of hard-coding one dashboard width |
| 12px grid gap and 12px container padding | Quiet spacing creates the Basedash visual rhythm | Make gap/padding tokens and use the same geometry in placement and screenshots |
| ~140px minimum column width before the grid stops shrinking | A grid should preserve usable cards rather than squeeze text forever | Add a controlled narrow mode or horizontal overflow policy; never let the chart silently clip its semantics |
| ≤480px single-column mode | At very narrow widths, layout semantics change, not only dimensions | Collapse dashboard filters and place widgets one per row; preserve each widget’s own adaptive plan |
| React Grid Layout with vertical compaction and collision push-down | Dragging/resizing is familiar and predictable | Make compaction, collision, and persistence explicit options with stable IDs and commit callbacks |
| Four corner resize handles in edit mode | Editing is visible and direct | Add keyboard-resize and a header drag handle; interactive chart content must cancel grid dragging |
| Filters are dashboard-level and shared by variable name | One filter can coordinate many cards | Use typed filter IDs and explicit scope; do not infer state from SQL strings |
| Headers and text occupy grid space | Narrative can be a first-class dashboard item | Treat dashboard sections as grid items, but keep chart-local chrome inside the widget box |
| No documented postMessage or iframe resize protocol | Embedded dashboards need explicit integration seams | Provide controlled callbacks and a host-resize contract rather than assuming iframe height |

### Basedash visual grammar to adopt carefully

1. **Card first:** title and actions establish the card before the plot begins.
2. **Quiet chrome:** border and surface contrast should frame the data without competing with it.
3. **Large-space generosity:** extra width buys a legend, values, annotations, or an explanatory
   subtitle; it does not automatically create a thicker line or enormous empty plot.
4. **Meaningful overflow:** the wide donut reference makes the “Other” bucket visible in the legend;
   it does not silently discard categories.
5. **Dashboard context above cards:** date range, organization, interval, and other shared filters
   should be discoverable without duplicating a filter control in every chart.

### Basedash gaps we should deliberately solve

- Its public docs do not define how a tooltip moves between narrow and wide cards.
- Its public docs do not define a filter-bar collapse model at small widths.
- Its public chart API exposes very little of the visual contract: chart type and axis bindings are
  documented, while stroke, legend placement, tick density, and tooltip placement are not.
- The shipped image endpoint analyzed in the earlier research uses a fixed render size and forced
  light theme. Defence-Charts should keep layout and theme explicit for print/export and embedding.

The product changelog provides additional interaction evidence that is important for this plan:
responsive layouts move to a single column when the available width becomes tight; chart filters can
be independently scoped or dashboard-wide; long filter rows can scroll horizontally; and refreshes
can keep cached data visible while showing a subtle progress indicator. It also documents hover
tooltip/crosshair/legend interactions and stable chart color/legend ordering. These are product
signals, not a complete public API contract, so the library should preserve the behavior while
making the underlying state and geometry explicit. See [responsive layouts](https://www.basedash.com/changelog/2026-01-23),
[chart filters and long filter rows](https://www.basedash.com/changelog/2026-05-22),
[cached refresh and chart interactions](https://www.basedash.com/changelog/2026-06-19), and
[deterministic chart colors and legend ordering](https://www.basedash.com/changelog/2025-12-05).

## 3. What we are taking from shadcn and Recharts

### shadcn: composition and ownership

The shadcn pattern is valuable because it makes the chart shell understandable:

```text
ChartContainer
  ├── ChartConfig / semantic series tokens
  ├── chart renderer supplied by the consumer
  ├── ChartTooltip + ChartTooltipContent (optional)
  └── ChartLegend + ChartLegendContent (optional)
```

The important lesson is not to copy Recharts’ implementation. It is to expose a predictable
composition surface:

- `ChartContainer` owns the measured box, title association, theme variables, and overlay boundary.
- `ChartConfig` maps stable series IDs to labels, colors, icons, and formatting metadata.
- Tooltip and legend are independent components that can be replaced without replacing the chart.
- Loading, empty, and error states are part of the shell, not thrown in by each chart example.
- The source remains inspectable and customizable by the application.

For Defence-Charts, `ChartConfig` must remain separate from `ChartPlan`: configuration describes
series meaning and visual tokens; the plan describes what fits at this size.

### Recharts: concrete placement and accessibility lessons

Recharts documents that `ResponsiveContainer` watches the parent with `ResizeObserver`, while the
parent still needs a usable width/height or aspect ratio. Its `Tooltip` exposes offset, fixed
position, portal, and view-box escape options. Its `Legend` supports position, layout, offset, width,
and portal behavior. See [ResponsiveContainer](https://recharts.github.io/en-US/api/ResponsiveContainer/),
[Tooltip](https://recharts.github.io/en-US/api/Tooltip/), and [Legend](https://recharts.github.io/en-US/api/Legend/).

Recharts 3 also documents default keyboard navigation, arrow-key point movement, and tooltip updates
for supported chart types. The same story says a custom tooltip should expose a live region when it
must announce changing values. See [Recharts accessibility](https://github.com/recharts/recharts/blob/main/storybook/stories/API/Accessibility.mdx).

We should borrow:

- stable series keys and data keys;
- a tooltip payload model that separates the axis/header label from series rows;
- an explicit portal target for overlays;
- keyboard navigation through data points;
- a legend position/layout contract;
- package-level visual and accessibility tests.

We should not borrow:

- a React child tree as the source of responsive semantics;
- a tooltip that assumes every card has enough room to follow the cursor;
- raw data and visual layout decisions mixed into a single renderer component;
- a large runtime dependency surface in `@gx/core`.

## 4. The coordinate model

Every placement decision must declare which coordinate space it belongs to.

```text
Dashboard coordinate space
  grid columns, rows, gap, padding, drag/resize handles
        │
        ▼
Widget coordinate space
  card header, local controls, value region, plot/legend/table regions
        │
        ▼
Plot coordinate space
  axes, marks, labels, crosshair anchor, point positions
        │
        ▼
Overlay coordinate space
  tooltip, menu, filter popover, help text, portal/collision boundary
```

The conversion chain is:

```text
grid layout item
  → measured content box
  → SizeContext { cols, rows, width, height, aspect, sizeClass }
  → ChartPlan { information + interaction intent }
  → ChartFrame { plot rect + point coordinates + ticks }
  → WidgetLayout { region rects and overlay boundary }
  → static SVG + client interaction layer
```

### Geometry invariants

1. The grid determines the widget box; chart content never determines it.
2. `ChartPlan` may subdivide the measured box but may not grow it.
3. Tooltip and popover overlays are out-of-flow. They may escape the SVG view box, but they may not
   change the widget’s measured size.
4. A local filter row, if a chart has one, is a descendant of the measured widget and is charged in
   `WidgetLayout`. Dashboard-level filters are outside individual widget measurement.
5. Expanded data tables scroll inside the widget. They never become a sibling that makes the grid
   item taller.
6. The same `SizeContext` must produce both the plan and frame. No component may reconstruct grid
   units from pixels after the fact.
7. Resize preview can update the plan; layout persistence is committed separately at the end of the
   drag/resize gesture.

## 5. The future widget shell

The chart visual should be composed as a stable shell with independently adaptive regions.

```text
┌──────────────────────────────────────────────┐
│ Card header: title · description · actions   │  ← drag handle lives here
├──────────────────────────────────────────────┤
│ Local context/filter row (optional)          │  ← only for widget-scoped controls
├──────────────────────────────────────────────┤
│ Value / summary region (optional)            │
│                                              │
│ Plot region                    Legend region │
│ axes · marks · labels          internal/ext. │
│                                              │
├──────────────────────────────────────────────┤
│ Footer: table disclosure · source/status     │
└──────────────────────────────────────────────┘
                         └─ overlay layer: tooltip/crosshair/menu
```

### Region ownership

| Region | Owner | Can resize the measured widget? | Notes |
|---|---|---:|---|
| Card header | `@gx/grid` / composition layer | No | Title, description, drag handle, menu, status |
| Dashboard filter bar | `@gx/grid` / dashboard shell | It may change dashboard flow, not chart measurement | One shared state source for many widgets |
| Local filter row | `@gx/react` composition | No | Only when a filter is genuinely widget-scoped |
| Value/summary | `@gx/core` + primitives | No | Size-derived band, fitted from the inside |
| Plot | `@gx/core` + primitives | No | The remaining box after chrome is subtracted |
| Legend | `@gx/core` intent + React/HTML renderer | No | External legends subtract from plot; overlay legends do not |
| Tooltip/crosshair | `@gx/react` | No | Absolute/portal overlay; never participates in flow |
| Data table | `@gx/primitives` | No | Inside figure, scrolls within fixed widget |
| Loading/empty/error | composition layer | No | Occupies the same reserved shell region; no layout jump |

### Header behavior

- Full title and description in Panel/Canvas/Stage.
- Title only in Strip/Tile.
- Compact title or accessible name with no visible title in Micro.
- Actions use semantic buttons and are excluded from drag initiation.
- The plot, tooltip, filter controls, legend buttons, and table disclosure all cancel grid drag.
- A chart card should not have two competing hover systems: card hover is for edit affordances;
  chart hover is for data inspection.

## 6. Size-tier interaction and filter matrix

This extends the existing six-family ladder. The exact cell ranges remain those documented in
[`research/10-responsive-ladder.md`](10-responsive-ladder.md); the additions below specify shell and
filter behavior.

| Family | Visual content | Legend | Tooltip / crosshair | Filters and controls | User interaction |
|---|---|---|---|---|---|
| **Micro** 1×1 | One value, glyph, or compact status | Absent; series meaning must be encoded in the value/context | None on the surface | No visible filter control; dashboard filter button only | Whole widget is one tap target; open detail view/table |
| **Tile** 2×1–2×2 | Value + delta + sparkline/horizon | Direct or absent | Tap opens a fixed edge tooltip/detail sheet | Filter context appears as a short subtitle or active-filter badge | Tap, keyboard Enter/Space, no hover dependency |
| **Strip** 3×1–4×2 | Compact trend, no value-claiming y-axis | Direct or compact internal | Tap-to-reveal, fixed to top/bottom edge; no cursor-following | Dashboard filters stay outside the card; local controls collapse to one menu | Tap locks inspection; Escape/second tap closes |
| **Panel** 3×3–6×4 | Real chart, axes, direct labels | Direct labels first; internal if needed | Hover crosshair with fixed tooltip; keyboard focus shows same state | Dashboard filter bar may show one compact row above the grid; no duplicated per-card filters | Hover, focus, arrows, legend buttons if present |
| **Canvas** 6×5–8×6 | Chart + values + legend + annotations | External left/right/bottom based on measured fit | Fluid point/cursor tooltip with collision handling | Persistent dashboard filter row; 3–6 high-value controls visible, remainder in overflow | Hover, touch lock, arrows, brush/zoom when the chart family supports it |
| **Stage** 9×6–12×8+ | Full chart, annotations, secondary detail, small multiples | Full external legend, searchable/collapsible when needed | Fluid tooltip, crosshair, pinned comparison, optional portal | Full filter bar with groups, date range, compare, reset, and applied chips | Hover, keyboard navigation, touch, brush/zoom, legend toggling |

Two rules are non-negotiable:

1. **A larger card does not mean every control must become visible.** It earns controls only when
   the added control improves interpretation and has a stable placement budget.
2. **A filter is never hidden without a replacement path.** It can move from inline → overflow menu →
   drawer, but the user must see the applied state and have a clear reset path.

## 7. Dashboard filters at larger grid sizes

Basedash’s documented model is the right high-level direction: filters are dashboard-level controls
that can affect multiple charts. Its documentation says filters inject values into chart queries and
support dynamic dashboard slices; its earlier API/bundle research also found shared variables by name.
See [Basedash filters and variables](https://www.basedash.com/docs/features/filters-and-variables) and
the local [filter/grid evidence](raw/02-basedash-grid-model.md).

Defence-Charts should make that relationship explicit and framework-neutral.

### Keep three state axes separate

Higher-grid dashboards become unreliable when layout, filters, and data fetching are coupled. The
public model should keep these state axes distinct:

```text
layoutState  = positions, sizes, edit/view mode, draft/committed layout
filterState  = pending control values, applied values, scope, reset/default state
dataState    = idle, loading, refreshing, stale, empty, error, partial

layoutState changes → recompute widget measurements and plans
filterState commits → host fetch/cache boundary decides the data update
dataState changes   → preserve the same widget geometry and expose status
```

Moving a card must not reset filters. Changing a filter must not recompute unrelated layout rows.
Refreshing data must not collapse a widget or move its tooltip anchor. A host may persist all three
axes together, but the library should expose them as separate controlled inputs and callbacks.

### Proposed filter contract

This is a future serialisable data contract, not an implementation commitment yet:

```ts
type FilterScope = 'dashboard' | 'section' | 'widget'

type FilterDefinition = {
  readonly id: string
  readonly label: string
  readonly kind:
    | 'date-range'
    | 'single-select'
    | 'multi-select'
    | 'number-range'
    | 'boolean'
    | 'search'
  readonly scope: FilterScope
  readonly required: boolean
  readonly multiple: boolean
  readonly defaultValue: FilterValue
  readonly options: readonly FilterOption[] | null
  readonly description: string | null
}

type FilterValue = string | number | boolean | readonly string[] | { from: string; to: string } | null

type FilterState = {
  readonly values: Readonly<Record<string, FilterValue>>
  readonly appliedCount: number
  readonly pending: boolean
}
```

The library owns presentation and normalization. The host application owns data fetching, SQL,
query caching, permissions, and persistence.

### Filter bar modes

```text
wide dashboard / Stage-heavy layout
  [Date range] [Compare] [Team] [Region] [More filters] [Reset]

medium dashboard / Canvas-heavy layout
  [Date range] [2 visible filters] [4 filters applied] [Reset]
  └─ optional horizontal scroll for a long, still-useful filter row

narrow dashboard / Panel-heavy layout
  [Filters (4)] [Reset]
  └─ drawer / sheet with all controls

single-column mode
  filter state remains visible as a badge or summary above the grid;
  the controls open from one stable button, never from each chart
```

### Filter-bar overflow contract

Overflow is a responsive mode, not an accidental CSS side effect:

- **Wide:** render the most important filters inline in a stable order, followed by `More filters`,
  `Reset`, and an applied-count summary when necessary.
- **Medium:** keep the row single-line when possible; allow horizontal scrolling for a deliberately
  ordered row rather than wrapping controls into unpredictable card-height changes. The scroll
  container must expose an accessible name and preserve keyboard reachability for every control.
- **Narrow:** replace the row with one labelled filter button and a drawer/sheet containing all
  controls. Keep the applied count and a short summary outside the drawer.
- **Any width:** never put a dashboard filter popover inside a chart’s plot clipping boundary, and
  never allow opening the filter UI to change the grid item’s committed height.
- **Prioritization:** `FilterDefinition` should eventually carry an optional `priority` or `promoted`
  hint. The library may decide how many controls fit, but the host owns semantic ordering and must
  be able to override it.

### Filter behavior rules

- **Dashboard scope is the default.** One control updates all consumers that declare the same filter
  ID. This is clearer than parsing query text or inferring relationships from chart titles.
- **Section scope is optional.** It is useful for a group of cards that share a business context,
  but it must be visually grouped and named.
- **Widget scope is exceptional.** Use it for a chart-local brush, top-N selector, or categorical
  breakdown—not for the global date range.
- **Applied state is always visible.** Show a chip, count, or compact summary when the full bar is
  collapsed.
- **Updates are batchable.** A multi-select or date-range change should be able to commit once,
  preventing six charts from fetching six intermediate states.
- **Loading is non-destructive.** Keep the last valid chart visible with a loading indicator or use a
  same-size skeleton. Do not collapse the card to zero or change the grid geometry.
- **Errors preserve intent.** Show which filter combination failed and offer retry/reset; do not
  silently revert the user’s selection.
- **URL/state integration is opt-in.** The library exposes `onFilterChange` and a serialisable state;
  the host decides whether to put it in the URL, local storage, server state, or a router.
- **Locked filters are explicit.** An embed or host may mark a filter read-only; show the locked
  state rather than pretending the control is interactive.

### Filter placement inside a widget

Do not place the full dashboard filter bar inside every chart. For a widget-scoped control:

1. Place it in the card header or local filter row.
2. Measure the row before resolving the plot box.
3. Collapse it to an icon/button at Strip and below.
4. Never let its popover participate in normal flow.
5. Give it a stable `data-filter-scope="widget"` and a labelled relationship to the chart.

## 8. Tooltip architecture

Tooltips are not generic hover labels. A chart tooltip is a data inspection surface with a header,
series rows, formatting, active state, and keyboard/touch behavior.

### Tooltip payload

```ts
type TooltipModel = {
  readonly open: boolean
  readonly mode: 'fixed' | 'fluid'
  readonly anchor: {
    readonly x: number
    readonly y: number
    readonly index: number | null
    readonly seriesId: string | null
  } | null
  readonly label: string | null
  readonly rows: readonly {
    readonly seriesId: string
    readonly label: string
    readonly colorToken: string
    readonly value: string
    readonly rawValue: number | null
  }[]
  readonly hiddenRowCount: number
}
```

The model is serialisable. DOM measurement and pointer coordinates stay in the client interaction
layer.

### Placement algorithm

The overlay must be positioned against a named boundary, not against the viewport by accident.
Radix documents collision boundaries, side/align offsets, collision padding, arrows, and portal
containers for generic tooltips. Floating UI documents the corresponding `shift`, `flip`,
`autoPlacement`, `size`, and `arrow` concepts. See [Radix Tooltip](https://www.radix-ui.com/primitives/docs/components/tooltip)
and [Floating UI positioning](https://floating-ui.com/docs/usefloating).

#### Fixed mode — Strip and Panel

1. Select the active x-position from the nearest data point or axis bucket.
2. Anchor the tooltip to the widget’s top or bottom overlay rail, not to the cursor.
3. Keep the active vertical crosshair inside the plot.
4. Center on the active x-position, then clamp to the widget’s horizontal safe area.
5. If the preferred rail is occupied by the header/value region, flip to the opposite rail.
6. If the tooltip still cannot fit, reduce rows to the available budget and show `+N more` with the
   data-table disclosure as the full-value path.

Fixed mode is the default where a cursor-following surface would cover the only readable chart area.

#### Fluid mode — Canvas and Stage

1. Start from the pointer or active mark anchor in plot coordinates.
2. Convert the anchor to widget/viewport coordinates using the measured chart rect.
3. Try the preferred placement based on the anchor quadrant: above-right, above-left, below-right,
   below-left.
4. Apply `flip` when the preferred side has insufficient space.
5. Apply `shift` to keep the panel inside the collision boundary.
6. Apply `size`/max-height so a large series set becomes scrollable rather than overflowing.
7. Position an arrow or active marker so the visual relationship remains clear.
8. Recalculate when the widget, viewport, scroll container, or tooltip content changes.

The first implementation can use a small pure `placeTooltip()` function with measured rectangles.
An optional Floating UI adapter can be evaluated later in `@gx/react`; it must not enter `@gx/core`.

### Tooltip content rules

- The header is the x/category/time label; series rows are sorted by stable series order, not by
  changing pixel position.
- Use tabular numerals and the same formatter as the data table.
- Never rely on color alone; every row has a text label and value.
- A tooltip that is clipped or hidden by the card is a correctness failure.
- On touch, first tap opens/locks; second tap or Escape closes. Avoid hover-only behavior.
- On keyboard focus, the tooltip updates for the focused point and remains discoverable without
  moving focus into the tooltip.
- The tooltip should be concise. A separate table remains the complete data equivalent.

## 9. Crosshair and active-state architecture

The crosshair is a visual focus indicator, not a second chart.

```text
pointer / keyboard index
  → nearest data point or category
  → active index in interaction state
  → crosshair geometry in plot coordinates
  → tooltip model
  → accessible status text / table relationship
```

Rules:

- Crosshair lines are clipped to the plot region.
- They never extend through the title, legend, filter bar, or footer.
- The active point/series receives a visible focus treatment that meets the theme’s contrast
  contract.
- The crosshair follows the x bucket for shared time-series tooltips; it follows the mark for
  item-level bar/scatter/pie tooltips.
- On narrow sizes, use a single highlight band or marker instead of a full two-axis crosshair.
- The crosshair is absent when no interaction is available; no invisible pointer event surface is
  mounted in Micro.

## 10. Legend architecture

The existing `LegendPlan` is directionally correct: `absent`, `direct`, `internal`, and `external`
are states, not a single boolean. The placement decision must be resolved together with the plot
budget.

### Placement rules

| Available space | Preferred legend state | Fallback |
|---|---|---|
| Micro | Absent or encoded in summary | Open detail/table |
| Tile/Strip | Direct label or compact internal | Overflow menu |
| Panel | Direct end labels for lines; internal for categorical marks | Scroll/collapse |
| Canvas | External left/right if width allows | External bottom |
| Stage | External with values/percentages and controls | Searchable/collapsible legend |

The renderer should choose left/right/bottom based on measured label width and the remaining plot
height/width, not solely on a fixed global position. Recharts’ public Legend API is useful precedent:
it distinguishes item layout from position and supports offsets, width, and portals. See [Legend API](https://recharts.github.io/en-US/api/Legend/).

### Interactive legend

- Legend entries are buttons when toggling is enabled.
- Use `aria-pressed` for visibility state.
- Keep hidden series in the legend so users can restore them.
- Use stable series IDs, not array indices, for color, focus, and toggle state.
- Toggling a series updates the plot and tooltip rows but does not rewrite the dashboard filter state.
- At Stage, a legend may support search or “show all”; at smaller sizes, use a disclosure.
- Do not use “Other” merely to hide legend rows. “Other” is a data aggregation state and must be
  represented in the data model and animation plan.

## 11. Resize, drag, and grid interaction

### Grid geometry contract

The grid should own a serialisable layout item:

```ts
type GridItemLayout = {
  readonly id: string
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
  readonly minW: number
  readonly minH: number
  readonly maxW: number | null
  readonly maxH: number | null
}
```

The actual pixel box is derived from the grid profile:

```text
columnPx = (containerPx - 2*paddingPx - (columns - 1)*gapPx) / columns
widgetWidthPx  = w*columnPx + (w - 1)*gapPx
widgetHeightPx = h*rowPx    + (h - 1)*gapPx
```

`@gx/grid` passes the resulting content-box width/height and the logical `w/h` to the chart. It
does not tell the chart which content to display.

### Resize lifecycle

```text
pointerdown on resize handle
  → preview layout item
  → measure widget content box
  → replan chart + update overlay boundary
  → paint visual feedback
  → pointerup
  → validate/compact layout
  → persist one committed layout change
```

Rules:

- Preview may be rAF-batched; persistence should happen once per gesture.
- Widget IDs remain stable through compaction and reordering.
- Chart data does not refetch merely because a card changed size.
- A resize crossing a plan boundary may change the tooltip/legend mode immediately, but the grid
  should not animate the card’s outer dimensions through content.
- The chart should provide a visible “content changed with size” state only when the change would be
  otherwise surprising, such as line → horizon or legend → direct labels.
- Dragging begins from a header handle or card chrome. Plot marks, legends, tooltips, filters, table
  controls, and menus cancel grid dragging.
- Keyboard users need a separate resize affordance or a documented grid-level resize mode; corner
  handles alone are insufficient.

### Minimum footprint policy

Do not copy Basedash’s absence of per-item minimums as the final contract. Instead:

- every chart can degrade to a truthful Micro state;
- a consumer may declare a minimum footprint when a product requirement demands it;
- if a minimum is violated, show a clear resize affordance or move the widget to a single-column
  fallback—not a silently clipped chart;
- the planner must still remain valid at 1×1 for generic widgets.

## 12. Loading, empty, error, and stale states

These states need the same visual discipline as the successful chart.

| State | Visual treatment | Interaction |
|---|---|---|
| Loading, no prior data | Same card shell; skeleton respects the planned region budget | Filters remain usable; no resize jump |
| Refreshing, prior data present | Keep chart visible; quiet progress indicator in header | Tooltip/legend may remain usable against prior data, marked stale if needed |
| Empty result | Title + plain-language explanation + active-filter summary + reset action | Keyboard-focusable reset/filter action |
| Error | Compact error panel inside card + retry; preserve filter context | Retry and details actions; no thrown render error |
| Partial series/data | Render available series; explicit missing indicator in tooltip/table | Do not recolor series unpredictably |
| Locked filter | Normal value display with lock affordance and description | Cannot edit; host can explain why |

No state may change the outer grid item’s measured height as a side effect.

## 13. Accessibility contract

The current static chart already uses the WAI-ARIA Graphics model’s `graphics-document` direction.
The W3C graphics module describes structured graphics, nested graphics documents, and semantic
relationships between graphical parts. See [WAI-ARIA Graphics](https://www.w3.org/TR/graphics-aria-1.0/).

### Static chart

- `<figure>` owns the chart and its text equivalent.
- `<svg role="graphics-document">` has an accessible title and optional description.
- The data table remains HTML, outside the SVG, inside the figure.
- Every series has a stable ID and a text label.
- A chart never uses color as the only series distinction.
- The chart remains meaningful with animation disabled and CSS custom properties unavailable.

### Interactive chart

- A keyboard user can focus the chart or an explicit chart interaction control.
- Left/right arrows move through the active data index for time/category charts.
- Home/End move to the first/last index where useful.
- Escape closes a tooltip, popover, or detail state without moving focus unexpectedly.
- The focused data state is represented in the tooltip/status text and visually in the plot.
- Legend toggles are labelled buttons with `aria-pressed`.
- Filter controls use native labels, field grouping, and descriptions; a collapsed filter button
  announces the number of applied filters.
- A tooltip is not a focus trap. The WAI-ARIA tooltip pattern keeps focus on the trigger, uses
  `role="tooltip"`, and associates the trigger with `aria-describedby`. See [WAI tooltip pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/).
- Rapid chart updates should use a concise status/live-region strategy rather than announcing a
  full multi-series payload on every pointer movement.
- `prefers-reduced-motion`, high contrast, forced colors, zoom, and touch must retain the same data
  meaning even if visual transitions or hover affordances disappear.

### Drag and resize accessibility

- Edit mode is announced and visually distinct from view mode.
- A widget exposes its position/size in accessible text or a properties panel.
- Keyboard resize changes one grid unit at a time and announces the result.
- A keyboard-operable resize handle may use a focusable `separator` with `aria-orientation`,
  `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, and an accessible size description. Its
  `aria-controls` relationship must identify the widget it changes. If the chosen grid engine cannot
  expose this semantics, provide a separate properties/size editor instead.
- Dragging is not the only way to reorder a dashboard.
- A resize handle never steals focus from a chart point without a clear user action.

## 14. Proposed package/API boundaries

### `@gx/core`

Keep this package DOM-free and React-free.

- `SizeContext`
- `ChartPlan`
- `ChartFrame`
- pure `WidgetLayout` / region-budget math
- pure tooltip candidate placement from serialisable rectangles
- pure legend layout decision
- stable series/filter metadata types only when they have no UI dependency

Do not put `ResizeObserver`, portals, pointer events, query fetching, or filter widgets here.

### `@gx/primitives`

- static SVG marks, axes, gridlines, labels, values;
- semantic `<figure>` / SVG / data-table structure;
- non-interactive legend rendering when supplied a resolved plan;
- loading/empty/error primitives that do not own async state.

### `@gx/react`

- `AutoChart`
- `ChartContainer`
- `ChartTooltip` / `ChartTooltipContent`
- `ChartLegend` / `ChartLegendContent`
- `ChartInteractionProvider`
- `useElementSize`, pointer/keyboard state, portal overlay, and optional client-only placement adapter.

### `@gx/grid`

- `DashboardGrid`
- `GridItem`
- `DashboardFilterBar`
- `FilterButton` / `FilterDrawer`
- layout preview/commit callbacks;
- drag/resize handles, keyboard resize, persistence adapters;
- dashboard-level loading/stale/error coordination.

The grid should accept any widget renderer. It must not import chart-type switches or inspect
`ChartPlan.marks`.

## 15. Implementation sequence

### Phase V0 — contract closure

1. Freeze the region vocabulary and decide whether card headers live in `@gx/grid` or a new
   composition entry point.
2. Add `WidgetLayout` as a pure layout contract without changing the current `ChartPlan` fields.
3. Define stable series metadata and the serialisable filter types.
4. Add a `DashboardState` example with two charts sharing one date-range filter.

### Phase V1 — real grid shell

1. Replace the `@gx/grid` constant-only surface with a controlled grid component.
2. Implement 12-column layout, gap/padding tokens, vertical compaction, collision handling, and
   stable layout IDs.
3. Add resize preview/commit and consumer callbacks.
4. Add edit/view mode, header drag handle, drag cancellation selectors, and keyboard resize.
5. Verify a widget’s content never changes the grid item’s outer box.

### Phase V2 — visual shell and region budgets

1. Implement `ChartContainer` and card header/footer semantics.
2. Move title/action layout out of SVG-only space while keeping the SVG title association.
3. Implement plot/value/legend/table region geometry from one `WidgetLayout`.
4. Add BaseDash-inspired dark/light theme tokens and shadcn-style series config.
5. Implement stable loading, empty, error, and stale states.

### Phase V3 — tooltip and crosshair

1. Add frame-level active-index metadata and nearest-point lookup.
2. Implement fixed placement for Strip/Panel.
3. Implement fluid placement with pure candidate math and collision tests for Canvas/Stage.
4. Add portal boundary, scroll/resize recomputation, max-height, overflow rows, arrow/focus marker.
5. Add pointer, touch, keyboard, Escape, and reduced-motion behavior.

### Phase V4 — legends and filters

1. Implement direct/internal/external legend renderers.
2. Add keyboard-accessible legend toggles and stable hidden-series state.
3. Implement dashboard-level filter bar with visible/overflow/drawer modes.
4. Add shared dashboard, section, and explicitly scoped widget filters; support batch updates, reset,
   applied chips, loading/stale/error behavior, and locked-filter presentation.
5. Verify a filter update reaches all subscribed widgets without duplicating controls or refetching
   on every intermediate selection.

### Phase V5 — chart family expansion

Implement one family at a time, each with a complete size matrix:

1. line/area interaction parity;
2. bar/timebar;
3. donut/pie with visible “Other” aggregation;
4. scatter with performance boundary;
5. KPI/progress;
6. funnel/heatmap;
7. secondary axes, brush, zoom, annotations, and small multiples.

No chart family is “done” when it only renders at Stage. Each must have Micro → Stage semantics,
tooltip/legend/filter behavior, accessible equivalent, and resize tests.

### Delivery estimate and reliability verdict

These are planning estimates, not commitments. They assume one experienced TypeScript/React engineer,
the current line/area baseline, no backend/query client inside the library, and time for browser
verification. A second engineer can work on grid/filter and chart interaction in parallel only after
the shared geometry and identity contracts are frozen.

| Slice | Main output | Estimate |
|---|---|---:|
| V0 contract hardening | stable point identity, widget layout types, grid-column decision, state separation | 2–4 days |
| V1 grid shell | controlled drag/resize, collision/compaction, edit mode, persistence callbacks | 5–8 days |
| V2 visual shell | card/header/region budgets, theme/config, stable loading/empty/error/stale states | 4–7 days |
| V3 interaction | fixed/fluid tooltip, crosshair, portal boundary, touch, keyboard, resize recomputation | 7–12 days |
| V4 legend + filters | direct/internal/external legend, shared/local scopes, overflow/drawer, batching and applied state | 7–12 days |
| V5 hardening | browser matrix, accessibility, reduced motion/forced colors, performance and documentation | 7–12 days |

That puts a credible line/area production baseline at roughly **6–9 focused engineer-weeks** for one
engineer, or **3–5 calendar weeks** with two engineers and disciplined contract ownership. Adding each
new chart family should be estimated separately; it is not free once tooltip, legend, table, filters,
and six size tiers are required.

The reliability verdict is **conditionally strong, but not yet production-ready for the interactive
promise**. The current design is reliable if the grid owns the outer box, core owns pure geometry,
overlays stay out of normal flow, filter/data/layout state remains separate, and stable datum identity
is added before interaction. It is not reliable to ship resizable interactive dashboards by only
adding CSS, wrapping the current SVG in a responsive container, or turning on a grid engine without
the acceptance matrix below.

## 16. Reliability and acceptance tests

### Pure/core tests

- `SizeContext` stays stable for the same grid/pixel inputs.
- `ChartPlan` round-trips through JSON without semantic change.
- `WidgetLayout` never returns a negative region or a region outside the measured box.
- Tooltip candidate placement either fits the collision boundary or returns a bounded fallback with
  an explicit overflow-row count.
- Fixed placement never depends on pointer x/y after the active index is selected.
- Fluid placement is deterministic for the same anchor, tooltip size, boundary, and safe padding.
- Legend direction/position changes when measured width/height makes the preferred placement invalid.
- Filter state normalization is deterministic and does not mutate the caller’s object.

### React/static tests

- `<Chart>` renders without browser globals and retains the SVG/data-table accessibility contract.
- Client interaction code is absent from the static/RSC path.
- Tooltip and legend components do not mount in Micro when the plan says interaction is absent.
- The chart and its overlay use stable IDs through resize.
- Data-table disclosure stays inside the measured element and scrolls internally.

### Browser tests

Test at least these footprints: `1×1`, `2×1`, `3×1`, `3×3`, `6×5`, `9×6`, plus portrait and ultrawide
variants.

- Drag and resize in all supported directions; no `ResizeObserver` loop errors.
- Resize across every plan boundary with tooltip open; overlay remains attached and visible.
- Tooltip near every plot corner flips/shifts without clipping.
- Tooltip remains inside the widget boundary in fixed mode and within the configured portal boundary
  in fluid mode.
- Legend changes from direct → internal → external as space changes without data reordering.
- Dashboard filter bar moves inline → overflow → drawer without losing applied state.
- One shared filter updates multiple charts; reset returns all charts to the same baseline.
- Filter loading, stale data, empty results, and errors preserve card height and layout.
- Plot marks do not start grid dragging; header drag does.
- Keyboard chart focus, arrow navigation, Escape, legend toggles, filter controls, and keyboard
  resize all work without a mouse.
- Filter and resize controls expose stable labels, relationships, and values in the accessibility
  tree; the chart’s active-filter summary changes when applied state changes.
- Touch tap-to-lock works; hover is never the only path to data.
- Dark/light, forced colors, high contrast, zoom, reduced motion, and RTL do not remove meaning.

### Visual regression matrix

Each chart family should have screenshots at:

```text
theme: dark, light, forced-colors
size: Micro, Tile, Strip, Panel, Canvas, Stage
state: normal, loading, empty, error, stale, tooltip-open, legend-toggle, filters-applied
interaction: view mode, edit mode, reduced motion
```

The snapshot should compare region boundaries and semantics, not only pixels: chart type, size class,
legend placement, tooltip mode, active filter count, and data-table presence should be asserted in the
DOM alongside the image.

## 17. Open decisions before implementation

1. **Grid engine:** use React Grid Layout, another maintained engine, or a small owned layout layer.
   The decision must include keyboard resize, controlled layout, CSS transforms, and SSR behavior.
2. **Tooltip placement:** own the pure placement math first; optionally add a Floating UI adapter in
   `@gx/react`. Do not make a DOM placement library a core dependency.
3. **Chart header ownership:** `@gx/grid` should own dashboard-level card chrome; decide whether a
   reusable `ChartContainer` lives in `@gx/react` and can also be used outside the grid.
4. **Filter data model:** define whether `FilterDefinition` is part of `@gx/core` or `@gx/grid`.
   The default recommendation is `@gx/core` for serialisable types and `@gx/grid` for UI.
5. **Filter fetching:** remain presentational-only. The host must supply data and callbacks; no
   network client belongs in the library.
6. **Filter persistence:** expose controlled state and callbacks; leave URL/local/server persistence
   to the host.
7. **External legend direction:** use measured fit to choose left/right/bottom, with a consumer
   override for product-specific art direction.
8. **Ultrawide grid contract:** decide whether 18 columns are represented by a widened `SizeContext`,
   a grid-only profile, or a separate dashboard coordinate system; add contract tests before exposing
   that mode.
9. **Filter prioritisation:** define the stable default order and the host override for which filters
   are promoted inline at wide/medium widths.
10. **Accessible active chart role:** keep `graphics-document` for the static chart and test whether a
   focusable SVG/HTML controller is sufficient before considering an application-style role.
11. **Pro boundary:** advanced export, high-volume renderers, linked views, and enterprise filter
   persistence belong in sibling packages, not hidden branches in the Free renderer.

## 18. Source ledger

### Product references

- [Basedash Charts documentation](https://www.basedash.com/docs/features/charts) — chart types,
  breakdowns, visual customization, and chart authoring model.
- [Basedash Dashboards documentation](https://www.basedash.com/docs/features/dashboards) — resizing,
  arrangement, sections, dashboard filters, sharing, and embedding.
- [Basedash Filters and Variables](https://www.basedash.com/docs/features/filters-and-variables) —
  dashboard-level filter behavior and dynamic data slices.
- [Basedash Embedding](https://www.basedash.com/docs/features/embedding) — public/embed context and
  host integration constraints.
- [Basedash responsive layouts changelog](https://www.basedash.com/changelog/2026-01-23) — tight-width
  single-column behavior.
- [Basedash chart filters changelog](https://www.basedash.com/changelog/2026-05-22) — chart-local versus
  dashboard-wide filter scope, long-row overflow, and filter interaction details.
- [Basedash cached refresh and chart interaction changelog](https://www.basedash.com/changelog/2026-06-19) —
  stale-data presentation, progress indication, tooltip/crosshair, and legend interaction signals.
- [Basedash deterministic chart styling changelog](https://www.basedash.com/changelog/2025-12-05) — stable
  colors, limited legend entries, and deterministic ordering.
- [Local Basedash grid/filter artifact analysis](raw/02-basedash-grid-model.md) — shipped-bundle
  geometry, RGL behavior, filter model, token observations, and explicit unverified items.
- [Local Basedash chart-type analysis](raw/01-basedash-chart-types.md) — chart-type behavior,
  category guidance, breakdown limits, and the absence of a published responsive chart contract.

### Composition and chart references

- [shadcn Chart documentation](https://ui.shadcn.com/docs/components/radix/chart) — copy-owned
  `ChartContainer`, `ChartConfig`, tooltip, legend, CSS variables, and composition model.
- [shadcn chart source](https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/new-york-v4/ui/chart.tsx) —
  source implementation and semantic series configuration.
- [Recharts Tooltip API](https://recharts.github.io/en-US/api/Tooltip/) — offset, fixed position,
  portal, and view-box escape options.
- [Recharts Legend API](https://recharts.github.io/en-US/api/Legend/) — position, layout, offset,
  width, and portal options.
- [Recharts ResponsiveContainer API](https://recharts.github.io/en-US/api/ResponsiveContainer/) —
  parent measurement through `ResizeObserver`.
- [Recharts accessibility story](https://github.com/recharts/recharts/blob/main/storybook/stories/API/Accessibility.mdx) —
  keyboard point navigation and tooltip/screen-reader behavior.
- [Radix Tooltip](https://www.radix-ui.com/primitives/docs/components/tooltip) — collision boundary,
  side/align offsets, portal, arrow, and collision-aware state.
- [Floating UI positioning](https://floating-ui.com/docs/usefloating) — `shift`, `flip`, `autoPlacement`,
  `size`, and `arrow` positioning concepts.

### Accessibility references

- [WAI-ARIA Graphics Module](https://www.w3.org/TR/graphics-aria-1.0/) — structured graphics,
  `graphics-document`, nested graphics, and semantic navigation.
- [WAI-ARIA Tooltip Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/) — tooltip role,
  `aria-describedby`, focus retention, and Escape behavior.
- [WAI-ARIA Window Splitter Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/) —
  keyboard-operable separator values and controlled-region semantics for resize affordances.
- [WCAG 2.2 Content on Hover or Focus](https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html) —
  dismissible, hoverable, and persistent content requirements relevant to tooltips and filter popovers.
- [WCAG 2.2 Target Size Minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) —
  minimum interactive target guidance for handles, legend buttons, and compact filter controls.

### Internal Defence-Charts references

- [`research/10-responsive-ladder.md`](10-responsive-ladder.md) — six information-density families,
  fixed/fluid tooltip intent, legend behavior, and chart-family ladders.
- [`research/40-chart-plan.md`](40-chart-plan.md) — public plan shape, region/legend/interaction/data
  table contracts, containment, and motion requirements.
- [`research/82-package-ecosystem-benchmark.md`](82-package-ecosystem-benchmark.md) — Recharts,
  shadcn, Basedash, package boundaries, and Free/Pro architecture.
- [`packages/core/src/plan.ts`](../packages/core/src/plan.ts) — current plan types.
- [`packages/core/src/layout.ts`](../packages/core/src/layout.ts) — current single-pass plot-box math.
- [`packages/primitives/src/Chart.tsx`](../packages/primitives/src/Chart.tsx) — current static semantic
  SVG/data-table renderer.
- [`packages/react/src/AutoChart.tsx`](../packages/react/src/AutoChart.tsx) — current measurement,
  deadband, planning, and client boundary.
- [`packages/grid/src/index.ts`](../packages/grid/src/index.ts) — current grid boundary stub.

## Final build rule

The library is ready to expand only when a chart can answer all of these questions from its own
measured box:

1. What can the user legitimately understand at this size?
2. Where do title, value, plot, legend, table, and overlays belong?
3. How does the tooltip remain visible at every edge and interaction mode?
4. How does the legend remain identifiable when space changes?
5. Where do shared filters live, and how does the user see their applied state?
6. What happens for loading, empty, error, stale, touch, keyboard, reduced-motion, and forced-color
   environments?
7. Can the same state be tested without a browser and verified in a real browser during resize?

If any answer is “the application can figure it out,” that behavior is not yet a library contract.
