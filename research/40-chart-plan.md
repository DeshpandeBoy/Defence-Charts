# The `ChartPlan` contract

> Closes the circular reference at `20-architecture.md:89`, which declared
> `type ChartPlan = { /* see 10-responsive-ladder.md for the full field list */ }` — and
> `10-responsive-ladder.md` has no field list. It has per-family prose and five field names used
> incidentally in examples.

This is **the public contract of the whole library**. `30-implementation-plan.md` makes it the reason
the project stays on `0.x` until it has survived contact with real consumers. Every other document
describes behaviour; this one describes the object that behaviour is expressed in.

**Scope.** Line/area is specified in full — it is Milestone A's only chart type. The *shape* must
generalise to all seven ladders in `10-responsive-ladder.md` §4; §7 and §8 below walk donut and KPI
against the type on paper, because those two stress it hardest (`aggregate` and composition
respectively).

---

## 1. The four constraints

Every one of these is already established elsewhere in the corpus. They are collected here because
they are the acceptance criteria for the type, and three of the four are violated by the *obvious*
design.

### 1.1 Per-rung complete specs, not diffs

`10-responsive-ladder.md` §0 row 1 and §4 preamble: *"Read as complete specs, not diffs. Each row
states everything that renders at that rung. A rung may contain something a larger rung does not."*

Kim et al.'s 378-pair corpus documents content that appears **only at small size** — summary text,
call-out lines, context views, and legends. The Micro summary phrase has no place on a Stage.

**Consequence for the type:** no field may be optional-meaning-inherit. A `ChartPlan` is total —
every field has a value at every rung. A partially-specified plan is not a plan.

### 1.2 Invertible

`10-responsive-ladder.md:112`: *"All actions are invertible. Kim et al. state the taxonomy works
small→large as well as large→small. The `ChartPlan` must express both directions."*

**Consequence for the type — a naming rule:** *no field may be named for an action; every field names
a state.* `legend.placement`, never `legend.hidden`. `marks.points.mode`, never `dropPoints`. An
action-named field encodes a direction of travel, and a type that encodes direction cannot be
inverted without a second, mirror-image vocabulary.

This is also why `legend` cannot be a boolean or a scalar — see §1.2 of the legend group in §4.

### 1.3 Containment — no field may influence the measured box

`10-responsive-ladder.md` §1.1 and `raw/05-theory-responsive-viz.md`, which calls this *a validity
constraint for the `ChartPlan` type*: the measured element's size must be grid-determined, never
content-determined, and the plan may only affect **descendants** of the measured box.

**Consequence for the type, stated as an invariant:**

> Every `ChartPlan` field describes a subdivision of, or an element inside, the measured box.
> **No field names an outer dimension.** There is no `width`, no `height`, no widget margin.

Two fields look like violations and are not, and the distinction has to be written down or someone
will implement them wrongly:

| Field | Reads as | Actually means |
|---|---|---|
| `legend.placement: 'external'` | outside the widget | outside the **plot area**, inside the measured box. It shrinks the plot; it never grows the box. |
| `dataTable` expansion | pushes the figure taller | the disclosure lives **inside** the measured element and scrolls within it. A table rendered as a sibling of the measured box would grow it, and that is the infinite loop. |

⚠ **The resolver is single-pass, and must stay that way.** Note the near-cycle: y-tick label widths
set the y-axis gutter → gutter sets plot width → plot width sets x tick count (§6) → x tick count
sets x label widths. If x-label width were allowed to feed back into the y gutter, the resolver would
need a fixpoint, and a fixpoint inside a `ResizeObserver` callback is the loop error by another
route. **Fixed order, one pass, no re-entry:** y gutter → plot width → x tick count → x label
degrade. Degradation affects only the axis it degrades.

### 1.4 Plain and serialisable

Decision 8. The plan must round-trip `JSON.parse(JSON.stringify(plan))` unchanged, or the server and
client paths in decision 7 cannot be proven identical.

- No functions, no class instances, no `Date`, no `Map`/`Set`, no `undefined`.
- **Absence is spelled, never implied.** `null` for "no secondary axis", `'none'` for "no points" —
  never a missing key. `undefined` and "key absent" are indistinguishable after a JSON round-trip,
  and a type where they mean different things has a bug the test suite cannot see.
- Numbers are finite. No `NaN`, no `Infinity` — both become `null` in JSON.

---

## 2. `ChartType`

```ts
type ChartType =
  | 'line' | 'area'          // one ladder, §4 "Line / area"
  | 'bar' | 'timebar'
  | 'donut'                  // 'pie' is a presentation variant, not a type
  | 'scatter'
  | 'funnel'
  | 'kpi'
  | 'heatmap'
  | 'progress';
```

`'area'` resolves to the same ladder as `'line'` and differs only by `marks.primary.area`. It stays a
distinct `ChartType` because consumers reach for it by name, and because the resolver may legitimately
choose different defaults (an area chart's baseline makes `hasNegative` matter more).

---

## 3. `ChartPlan` — top level

```ts
type ChartPlan = {
  readonly type: ChartType;
  readonly sizeClass: SizeClass;
  readonly valueLegibility: ValueLegibility;
  readonly orientation: 'vertical' | 'horizontal';
  readonly regionOrder: readonly RegionName[];

  readonly axes:        AxesPlan;
  readonly marks:       MarksPlan;
  readonly labels:      LabelsPlan;
  readonly legend:      LegendPlan;
  readonly interaction: InteractionPlan;
  readonly narrative:   NarrativePlan;
  readonly aggregate:   AggregatePlan;
  readonly dataTable:   DataTablePlan;
  readonly motion:      MotionPlan;
};
```

`type` and `sizeClass` are echoed from the inputs deliberately: the plan must be **self-describing**,
because it is snapshot-tested in isolation and transmitted server→client without its inputs.

### `valueLegibility` — the honesty field

```ts
type ValueLegibility = 'values' | 'shape-only' | 'single-value';
```

| Value | Meaning | Rungs |
|---|---|---|
| `single-value` | No plot to read from. One number is stated outright. | Micro, Tile |
| `shape-only` | A mark is drawn but the chart **does not claim** a reader can estimate values from it. | Strip |
| `values` | The chart claims value legibility and must therefore carry a y-axis. | Panel, Canvas, Stage |

This exists because of `10-responsive-ladder.md` §3: below 40 px plot height, value-estimation error
rises significantly (p < 0.001), and §4 Strip says explicitly that it *"does not claim value
legibility"*. Rather than leaving that as prose, it is a field, and it gates two other decisions —
whether `axes.y` may be visible, and whether `labels.valueLabels` may be anything but `'none'`.

⚠ **This is the field most worth arguing about**, because it is the library's central honesty claim
made machine-checkable: *an axis a reader cannot read values off is a promise the chart cannot keep*
(`DESIGN.md:154`). A CI assertion that `valueLegibility !== 'values' → !axes.y.visible` is the cheapest
possible guard on the thesis.

**Tier: B** — the 40 px boundary is A-lit (Heer & Bostock 2010); reifying it as a three-valued field
is ours.

### `regionOrder` — composition without recursion

```ts
type RegionName = 'value' | 'plot' | 'legend' | 'table';
```

`10-responsive-ladder.md:237` — *"This type is the proof that widget = composition, not a single
mark. `NumberDisplay` and `TimeBar` are separate components the plan may combine."*

The obvious design is a recursive `ChartPlan` with child plans in slots. **Rejected.** Recursion makes
the containment invariant (§1.3) unprovable — a nested plan could specify a region size that grows its
parent — and it makes snapshot diffs unreadable at exactly the moment they matter.

Instead: a flat plan with an explicit vertical stacking order. A region is present iff its own group
says so (`plot` iff `marks.primary.kind !== 'none'`, `value` iff `narrative.valueDisplay !== 'none'`,
and so on). `regionOrder` carries only the **order**, and lists only present regions.

Side-by-side arrangement is *not* expressed here — it is carried by `legend.position` (`'left'`/
`'right'` imply side-by-side, `'top'`/`'bottom'` imply stacked). One fact, one field.

**Tier: C** — ours. No published source describes widget region ordering.

---

## 4. The field groups

Each group below states its source rung, then its provenance tier. Per the plan's own verification
rule, **every field traces to a rung in `10-responsive-ladder.md` §4/§5, or is labelled Tier C.**

### 4.1 `axes`

```ts
type AxesPlan = {
  readonly x:  AxisPlan;
  readonly y:  AxisPlan;
  readonly y2: AxisPlan | null;      // Stage: "optional secondary axis"
};

type AxisPlan = {
  readonly visible:    boolean;
  readonly domainLine: boolean;      // the axis rule itself
  readonly ticks:      TickPlan;
  readonly title:      boolean;
  readonly gridlines:  boolean;
};

type TickPlan =
  | { readonly mode: 'none' }
  | { readonly mode: 'endpoints' }                        // Strip: first and last only
  | { readonly mode: 'count'; readonly count: number };    // §6: max(2, round(width / 100))
```

| Field | Rung source | Tier |
|---|---|---|
| `x.ticks.mode: 'endpoints'` | §4 Strip — *"x-axis endpoints only (first/last)"* | B |
| `x.ticks.count` | §6 — `max(2, round(width / 100))`, **no upper cap** (Talbot 2010) | A-lit |
| `y.ticks.count` 3–4 | §4 Panel — *"y-axis 3–4 ticks"* | B |
| `y.gridlines` true / `x.gridlines` false | §4 Panel — *"horizontal gridlines only"* | B |
| `y.title` | §4 Canvas — *"y-axis title"* | B |
| `y2` | §4 Stage — *"optional secondary axis"* | B |

⚠ `mode: 'endpoints'` is a distinct mode, not `count: 2`. Two ticks chosen by Talbot's algorithm land
on *nice* values; endpoints land on the **first and last data points**, which is a different claim —
it labels the extent of the data, not a readable scale. Collapsing them would silently upgrade Strip
to a value-legible chart.

⚠ `ticks-min: 2` (§6, Talbot's *"our lower bound"*) means `count` is never below 2 — but `mode:
'none'` is still reachable. "At least two ticks *if there are ticks*" is not "there are always ticks".

### 4.2 `marks`

```ts
type MarksPlan = {
  readonly primary:     MarkSpec;
  readonly points:      PointPlan;
  readonly pointBudget: number;
  readonly renderer:    'svg' | 'canvas';
};

type MarkSpec =
  | { readonly kind: 'none' }
  | { readonly kind: 'line';    readonly area: boolean }
  | { readonly kind: 'horizon'; readonly bands: 1 | 2 | 3 }
  | { readonly kind: 'bar';     readonly stacked: boolean; readonly grouped: boolean }
  | { readonly kind: 'arc';     readonly donut: boolean }
  | { readonly kind: 'point' }
  | { readonly kind: 'cell' };

type PointPlan = { readonly mode: 'none' | 'all' | 'extrema' };
```

| Field | Rung source | Tier |
|---|---|---|
| `kind: 'horizon'`, `bands` | §4 Tile — *"if plot height < 24 px: `replace` encoding with a 1-band horizon"* (Heer 2009) | B |
| `bands: 1 \| 2 \| 3` | §6 `horizon-max-bands: 3` — Heer 2009 *"we discourage 4 or more bands"* | A-lit |
| `points.mode: 'all'` | §4 Canvas — *"point markers"* | B |
| `pointBudget` 2000, `renderer` | §4 Scatter — *"above `pointBudget` switch the renderer to canvas rather than dropping data — never silently sample"* | C (rendering, no perceptual basis — §4 says so explicitly) |

⚠ **There is no `sparkline` mark.** §4 Tile says *"value + delta + sparkline"*, but a sparkline is
structurally a line with every axis off — which `axes` already says. Adding a `sparkline` kind would
encode the same fact in two places, and two fields that must agree are a bug surface, not a feature.
A sparkline is an *emergent description* of a plan, not a field in it.

⚠ The 24 px switch is a **`replace`, not a `rescale`** — the mark kind changes. That distinction is
the whole point of §0 row 7: *"below ~24 px plot height a line degrades measurably; the published fix
is to change encoding, not shrink."*

### 4.3 `labels`

```ts
type LabelsPlan = {
  readonly seriesLabels:     'none' | 'direct-end';
  readonly valueLabels:      'none' | 'all' | 'extrema';
  readonly axisLabelDegrade: DegradeStep;
  readonly maxChars:         number | null;   // abbreviation budget; null = no abbreviation
};

type DegradeStep = 'none' | 'abbreviate' | 'split' | 'rotate' | 'axis-transpose';
```

| Field | Rung source | Tier |
|---|---|---|
| `seriesLabels: 'direct-end'` | §4 Panel — *"direct end-of-line series labels"* | B |
| `axisLabelDegrade` order | §5.2 — `abbreviate → split → rotate → axis-transpose` (Talbot 2010; rotation *"a last resort … penalized heavily"*). The final transpose step is ours. | A-lit for the first three, B for the fourth |
| `maxChars` | §5.1 — Talbot penalises labels closer than **1.5 em**; abbreviation budget derives from that plus `measureText()` | A-lit (the spacing), B (the budget) |

`axisLabelDegrade` records the step **reached**, not the sequence applied — steps are cumulative and
ordered, so the terminal step names the state. That keeps the field a state rather than an action
(§1.2).

⚠ `'axis-transpose'` is the one degrade step with a side effect outside this group: reaching it flips
top-level `orientation`. Those two must be consistent, which is a second place the same fact is
encoded. **Accepted deliberately** — `orientation` is needed by consumers that never inspect
`labels`, and the alternative (deriving orientation) would make the plan non-self-describing. A
type-level assertion covers it: `labels.axisLabelDegrade === 'axis-transpose' → orientation ===
'horizontal'`.

### 4.4 `legend` — the non-monotonic one

```ts
type LegendPlan =
  | { readonly placement: 'absent' }
  | { readonly placement: 'direct' }
  | { readonly placement: 'internal'; readonly maxEntries: number }
  | { readonly placement: 'external';
      readonly position: 'left' | 'right' | 'top' | 'bottom';
      readonly maxEntries: number;
      readonly showValues: boolean;
      readonly showPercent: boolean };
```

§5.3 and §0 row 3: the published pattern is **externalise-at-large / internalise-or-add-at-small**.
Legends were observed being *added* at small size (E222, E116, E158) because a compact internal
legend costs less space than direct labels that do not fit.

⚠ **This is why `legend` cannot be a boolean, a scalar, or an enum ordered by size.** A monotonic
model produces the wrong layout at *both* ends: it drops the legend at Micro where it may be the only
way to identify a series, and it keeps a cramped internal legend at Stage where there is room outside
the plot. §0 row 3 marks this as one of only three places the literature **contradicted** v1.

⚠ It also breaks the existing shorthand. `10-responsive-ladder.md:52` and `20-architecture.md:109`
both show `<Chart plan={{ legend: 'hidden' }} />`. That is stale: `'hidden'` is not a placement (the
correct spelling is `'absent'`, per the Conceal Means Gone Rule — a hidden legend is still in the DOM),
and a bare string cannot carry `position` or `showValues`. **Both examples need updating to
`legend: { placement: 'absent' }`.** No shorthand is provided; one concept with two spellings is the
ambiguity §1.4 bans.

| Field | Rung source | Tier |
|---|---|---|
| `'direct'` | §4 Panel — direct end-of-line labels *are* the legend at that rung | B |
| `'external'` + `position` | §4 line/area Canvas — *"legend if > 4 series"*; §4 donut Canvas — *"legend `externalize`d left"* | B |
| `showValues` / `showPercent` | §4 donut Canvas — *"dot + name + value + percent"*, from the observed frame | A-impl (Basedash frame evidence) |
| `maxEntries: 8` | §6 Tier C — ⚠ *"no published number for legend capacity exists"* | **C** |

### 4.5 `interaction`

```ts
type InteractionPlan = {
  readonly trigger:      'none' | 'tap' | 'hover';
  readonly tooltip:      { readonly enabled: boolean; readonly placement: 'fix' | 'fluid' };
  readonly crosshair:    boolean;
  readonly brush:        boolean;
  readonly zoom:         boolean;
  readonly legendToggle: boolean;
};
```

Straight from §5.4, which makes interaction a first-class Target rather than an afterthought:

| Rung | `trigger` | `tooltip.placement` | Source |
|---|---|---|---|
| Micro / Tile | `'none'` | — | *"Hover targets are below fat-finger thresholds."* |
| Strip | `'tap'` | `'fix'` | *"Tap-to-reveal value. Tooltip `fix`ed to the widget edge."* |
| Panel | `'hover'` | `'fix'` | *"Hover crosshair; tooltip still `fix`ed."* |
| Canvas / Stage | `'hover'` | `'fluid'` | *"Tooltip goes `fluid` (follows cursor); brush, zoom, legend toggling."* |

**Tier: A-lit** for the `fix`/`fluid` distinction — it is Kim et al.'s documented `fix tooltip
position` strategy, and §2 records that v1 had *"no tooltip placement rule whatsoever"*.

⚠ `trigger: 'none'` at Micro/Tile does **not** mean the widget is inert. §5.4: *"Whole widget is one
tap target."* That is a shell/grid behaviour, not a chart behaviour, and it is deliberately outside
this plan — `@gx/grid` owns it. The plan describes what happens *inside* the box (§1.3).

### 4.6 `narrative`

```ts
type NarrativePlan = {
  readonly summaryPhrase:  boolean;
  readonly valueDisplay:   'none' | 'latest' | 'latest+delta';
  readonly valueTypeScale: number | 'fit';
  readonly deltaBasis:     boolean;
  readonly callouts:       'none' | 'extrema';
  readonly annotations:    boolean;
  readonly thresholdBands: boolean;
};
```

| Field | Rung source | Tier |
|---|---|---|
| `summaryPhrase` | §4 Micro — *"+ summary phrase ('↑ 12% this week') — the small-size-only `add`"* | A-lit (Kim et al.'s small-only `add`) |
| `valueDisplay: 'latest+delta'` | §4 Tile — *"value + delta + sparkline"* | B |
| `deltaBasis` | §4 KPI Tile — *"value + delta + comparison basis (`+1% (54.7K)`)"* | A-impl (observed frame) |
| `valueTypeScale: 'fit'` | §4 KPI Micro — *"value only, auto-fit type size"* | B |
| `callouts: 'extrema'` | §4 Stage — *"min/max/last call-outs"* | B |
| `annotations`, `thresholdBands` | §4 Stage — *"annotations … band/threshold shading"* | B |

⚠ `summaryPhrase` is the single field that most justifies §1.1. It is `true` at Micro and `false`
everywhere else — a **non-monotonic** field whose maximum is at the smallest rung. A diff-shaped
ladder cannot express it without a subtract-on-grow operation, which is precisely the structural
assumption the literature contradicted.

⚠ `valueTypeScale: 'fit'` is the only field requiring text measurement at plan time. It resolves
through `measureText()` and the `FontMetrics` plan-input token (`41-text-metrics.md`), **never**
through the DOM (decision 10). It is containment-safe: type size is derived *from* the box and cannot
grow it, provided the value region clips rather than overflows.

### 4.7 `aggregate`

```ts
type AggregatePlan = {
  readonly after:       number | null;   // aggregateAfter; null = never aggregate
  readonly minShare:    number | null;   // e.g. 0.02 — slices below this join "Other"
  readonly otherBucket: boolean;
  readonly expandable:  boolean;
  readonly temporalBin: 'none' | 'daily' | 'weekly' | 'monthly';
};
```

| Field | Rung source | Tier |
|---|---|---|
| `after: 8` | §4 donut — *"bucket into 'Other' once `categories > aggregateAfter` (default 8)"* | **B** — ⚠ §4 is explicit: 8 is **legend scannability, not perception**. Donuts survive to 24 categories. |
| `minShare: 0.02` | §4 donut — *"or any slice < 2%"* | **C** — §4: *"The 2% minimum slice has no published basis."* |
| `expandable` | §4 Stage — *"'Other' becomes expandable"* | B |
| `temporalBin` | §4 heatmap — *"below [min cell], bin weekly rather than shrinking further"* | C — §4 flags the 8 px cell floor as UNVERIFIED and says **do not cite** Heer & Bostock for it |

For line/area, `after` is `null` at every rung. Line charts do not bucket series into "Other", and
§4 Scatter's rule is *"never silently sample"*. The field exists on the shared type because donut and
heatmap need it — see §7.

⚠ `otherBucket: true` carries an **animation obligation**, not just a rendering one. §4: *"`aggregate`
requires object constancy: slices must visibly converge into 'Other'. A silent relabel violates
semantic correspondence (Heer & Robertson 2007)."* That is why `motion.objectConstancy` exists as a
separate field rather than being inferred — see §4.9.

### 4.8 `dataTable`

```ts
type DataTablePlan = {
  readonly present:           boolean;
  readonly disclosure:        'button' | 'widget-tap';
  readonly initiallyExpanded: boolean;
  readonly columns:           'all' | 'summary';
};
```

`20-architecture.md` treats the table as *"another rung of the responsive ladder"* rather than a
bolted-on accessibility feature, rendered in a `<figcaption>` inside a `<figure>`.

⚠ **`present` is `true` at every rung, including Micro.** This is the second non-monotonic group, and
it inverts: the table matters *most* exactly where `valueLegibility` is weakest. A Strip that
explicitly does not claim value legibility is the rung whose reader most needs the numbers.

⚠ `disclosure: 'widget-tap'` at Micro/Tile resolves what would otherwise be a conflict with
`DESIGN.md`'s Conceal Means Gone Rule. A 1×1 tile has no room for a toggle button, but a
visually-hidden-yet-present button is exactly the ghost element that rule bans. §5.4 already supplies
the answer — at those rungs *"the whole widget is one tap target"* — so no separate affordance
renders and nothing is concealed. **Tier: B.**

⚠ Containment (§1.3): the disclosure and the table must be **descendants of the measured element**,
and expansion scrolls within the fixed box. A table rendered as a sibling would grow the box on
expand, which is the `ResizeObserver` loop.

### 4.9 `motion`

```ts
type MotionPlan = {
  readonly durationClass:    'rescale' | 'recompose';
  readonly stages:           1 | 2;
  readonly persistGridlines: boolean;
  readonly objectConstancy:  boolean;
};
```

| Field | Rung source | Tier |
|---|---|---|
| `durationClass` | §7 — ~300 ms rescale-only, ~1000 ms when marks move | A-lit **and** A-impl — Heer & Robertson 2007's ~1000 ms and Spectrum's shipped `DRAW_IN_ANIMATION_DURATION_MS = 1000` agree exactly, arrived at independently (§6). Cite both. |
| `stages` | §7 — *"Stage 1 axis/ticks, stage 2 marks. Never more than two stages."* | A-lit |
| `persistGridlines` | §7 — *"they are the landmarks that make an axis change comprehensible. Do not remove and redraw."* | A-lit |
| `objectConstancy` | §4 donut, §7 — mandatory for `aggregate` | A-lit (Heer & Robertson 2007) |

⚠ **There is deliberately no `motion.enabled` field, and this is a correctness decision, not an
omission.** §7 requires respecting `prefers-reduced-motion`. That is a CSS media query — *the server
cannot read it*. A resolver field derived from it would produce one plan on the server and a different
plan on the client: a hydration mismatch on every animated chart, and the exact failure mode
`20-architecture.md` §3.2 documents.

The split that works: the **plan** carries the structural facts (how many stages, which duration
class, whether constancy is required); **CSS** decides whether the transition runs, via
`@media (prefers-reduced-motion: no-preference)`. Note the polarity — animation is *added* when no
preference is expressed, never *removed* from an explicit one, so the still chart is the baseline
artefact and the plan is valid unanimated.

### 4.9.1 What A6 actually consumed, and one field it did not

`packages/primitives/src/Chart.tsx` is `motion`'s **first and only consumer**. It echoes three of the
four fields onto the `<figure>` as `data-motion-duration`, `data-motion-stages` and
`data-persist-gridlines`, and `chart.css` binds durations and the stage delay off them. Everything
above survived contact unchanged, including the absent `enabled` field, which turned out to carry its
weight twice: gate **G19** asserts that `prefers-reduced-motion: reduce` produces no interpolated
frame *and* that the resting state is byte-identical either way, which is only a coherent pair of
assertions because the plan does not encode the preference.

⚠ **`objectConstancy` is NOT echoed, and reading it as "elements keep their identity across a resize"
is a mistake A6 nearly made.** It means what §4's donut section and §7 say it means: *slices visibly
converging into "Other"* during an `aggregate` step. It is correctly `false` at every line rung, and
flipping it to `true` to "enable" transition identity would have been a semantic change dressed as a
wiring fix.

Identity across a resize is a **keying** property, not a plan field, and it is not optional: decision
[016](decisions/016-what-svg-geometry-actually-transitions.md) measured that a replaced element never
transitions at all. `<Grid>` and `<Axis>` key by `tick.value` for that reason, and
`packages/primitives/src/identity.test.tsx` is what holds it. `persistGridlines` is the plan's
*statement of intent*; the keys are what make it true.

---

## 5. `PlanPolicy` and `PlanOverrides`

`20-architecture.md` §3.2 fixes the precedence: library defaults → `<GxConfig>` → per-chart props →
`planFn` last. Two distinct things flow through it, and conflating them is how the token-split bug
gets reintroduced.

```ts
// INPUT to planChart(). Plan-input tokens per 20-architecture.md §3.2 — TypeScript, via <GxConfig>,
// never CSS custom properties. These change what the resolver decides.
type PlanPolicy = {
  readonly tickTargetSpacing:    number;   // 100  — A-lit, Talbot 2010
  readonly ticksMin:             number;   // 2    — A-lit, Talbot 2010
  readonly labelMinSpacing:      number;   // 1.5em— A-lit, Talbot 2010
  readonly plotHeightOptimal:    number;   // 24   — A-lit, Heer 2009
  readonly plotHeightMinValues:  number;   // 40   — A-lit, Heer & Bostock 2010
  readonly plotHeightSaturation: number;   // 80   — A-lit, Heer & Bostock 2010
  readonly horizonMinHeight:     number;   // 6    — A-lit, Heer 2009
  readonly horizonMaxBands:      1 | 2 | 3;// 3    — A-lit, Heer 2009
  readonly categoriesMaxRadial:  number;   // 7    — A-lit
  readonly aggregateAfter:       number;   // 8    — B
  readonly legendMaxEntries:     number;   // 8    — C
  readonly pointBudget:          number;   // 2000 — C
  readonly substitute:           boolean;  // §5.6 — consumer may pin off
  readonly minCellSize:          number;   // C
  readonly typography:          FittingTypography; // six CSS inputs + FontMetrics, atomic
};

// APPLIED AFTER resolution. Forced values, deep-partial.
type PlanOverrides = DeepPartial<ChartPlan>;

function planChart(
  type: ChartType,
  ctx: SizeContext,
  shape: DataShape,
  policy?: Partial<PlanPolicy>,
  overrides?: PlanOverrides,
): ChartPlan;
```

⚠ This adds a fifth parameter to the signature at `20-architecture.md:91`, which has four. The
existing signature folds policy and overrides into one `overrides` argument — but they are applied at
different times (policy *before* resolution, overrides *after*) and mixing them makes
`aggregateAfter` ambiguous: as policy it is the threshold the resolver consults, as an override it is
a decided value the resolver is forbidden to revise. **`20-architecture.md` §3.1 needs updating.**

`aggregateAfter` legitimately appears in both `PlanPolicy` and `ChartPlan.aggregate.after`, and that
is not duplication: policy states the threshold, the plan records what was decided. They differ
whenever a rung aggregates more aggressively than the threshold.

`substitute: false` is policy, not an override — §5.6 says a consumer may pin substitution off, which
changes how the resolver decides rather than what it decided. Expressing it as
`overrides.marks.primary` would force one specific mark at every rung and break §1.1.

### 5.1 `valueRegionMaxShare` — a policy field this document did not list

**Added during A3, and it is a genuine addition rather than a transcription.** The vertical chain
charges the value region first, and a value region is sized from a font — so at a short widget the
narrative text can claim the entire box and leave a plot of zero height. Nothing in the corpus caps
it, because nothing in the corpus derives a plot height at all (§1.3 fixes only the horizontal
order). The cap is therefore Tier **C** — ours, unsourced — and it is named in `PlanPolicy` rather
than buried as a constant precisely so that a consumer who disagrees can move it.

It is a *share* and not a px figure so that it degrades sensibly at every rung instead of starving
the small ones.

### 5.2 Unions are atomic in `PlanOverrides`, with exactly one exception

`DeepPartial<ChartPlan>` makes every discriminated union **atomic**: you may replace a `MarkSpec`,
a `TickPlan`, a `FacetPlan` or a `LegendPlan` whole, and you may not half-override one. §1.1 is the
reason — a partial union merged onto a resolved plan produces an object matching no member of it,
structurally assignable to one, and it renders.

**`axes.y2` is the exception, and the argument for it is narrower than it first appears.**
`AxisPlan | null` is a union too, so the rule as first written forbade `{ y2: { visible: true } }`
outright. But the reason unions are atomic does not reach it: a partial `LegendPlan` is ambiguous
about *which variant* it completes, whereas a partial `AxisPlan | null` can only be completing the
one object member — `null` is not a shape a key can belong to. So `null` is stripped before the
union test, and whatever remains still faces it. A hypothetical `MarkSpec | null` would stay atomic
and merely regain its `| null`.

⚠ The first instinct was the opposite one: list `axes.y2` as atomic, on the grounds that merging a
partial onto `null` yields an incomplete `AxisPlan`. That is true and does not lead where it looks
like it leads — **replacing whole produces the same incomplete object.** Atomicity protects a field
from a bad merge; it does not make a partial total. A declared base to merge onto does, which is what
the implementation uses. Both directions are pinned by tests, because the fix is a *weakening* and a
weakening with only one test beside it drifts wider.

---

## 6. The six line/area rungs, hand-authored

The cheap paper version of the A3 snapshot suite. **If a rung cannot be expressed, the type is
wrong.** Shared fields are elided with `…` only where identical to the row above; the real plans are
total per §1.1.

### Micro (1×1)

```jsonc
{
  "type": "line", "sizeClass": "micro",
  "valueLegibility": "single-value", "orientation": "vertical",
  "regionOrder": ["value", "table"],
  "axes": { "x": OFF, "y": OFF, "y2": null },
  "marks": { "primary": { "kind": "none" }, "points": { "mode": "none" },
             "pointBudget": 2000, "renderer": "svg" },
  "labels": { "seriesLabels": "none", "valueLabels": "none",
              "axisLabelDegrade": "none", "maxChars": null },
  "legend": { "placement": "absent" },
  "interaction": { "trigger": "none", "tooltip": { "enabled": false, "placement": "fix" },
                   "crosshair": false, "brush": false, "zoom": false, "legendToggle": false },
  "narrative": { "summaryPhrase": true, "valueDisplay": "latest", "valueTypeScale": "fit",
                 "deltaBasis": false, "callouts": "none",
                 "annotations": false, "thresholdBands": false },
  "aggregate": { "after": null, "minShare": null, "otherBucket": false,
                 "expandable": false, "temporalBin": "none" },
  "dataTable": { "present": true, "disclosure": "widget-tap",
                 "initiallyExpanded": false, "columns": "summary" },
  "motion": { "durationClass": "recompose", "stages": 1,
              "persistGridlines": false, "objectConstancy": false }
}
// where OFF = { visible:false, domainLine:false, ticks:{mode:'none'}, title:false, gridlines:false }
```

`summaryPhrase: true` with **no mark at all**. This plan has a higher `narrative` content than the
Panel plan below, which is §1.1 made concrete.

### Tile (2×1 – 2×2)

Differs from Micro:

```jsonc
"marks":     { "primary": { "kind": "line", "area": false }, "points": { "mode": "none" }, … },
"narrative": { "summaryPhrase": false, "valueDisplay": "latest+delta", "valueTypeScale": 'fit', … },
"regionOrder": ["value", "plot", "table"]
```

⚠ **Conditional rung.** If plot height < 24 px (`plotHeightOptimal`), `marks.primary` becomes
`{ "kind": "horizon", "bands": 1 }` — a `replace`, not a `rescale`. If plot height also falls below
6 px (`horizonMinHeight`), the mark drops to `{ "kind": "none" }` and the rung degenerates to Micro's
shape while keeping Tile's `valueDisplay`. Note that this is the one place a *single* rung has three
possible mark states, all driven by measured plot height rather than by size class — which is why
`sizeClass` alone is not sufficient input to the resolver, and why `SizeContext` carries raw px.

The absence of axes is what makes this "a sparkline". There is no `sparkline` field (§4.2).

### Strip (3×1 – 4×2)

```jsonc
"valueLegibility": "shape-only",
"axes": {
  "x":  { "visible": true, "domainLine": true, "ticks": { "mode": "endpoints" },
          "title": false, "gridlines": false },
  "y":  OFF,
  "y2": null
},
"marks":       { "primary": { "kind": "line", "area": false }, "points": { "mode": "none" }, … },
"legend":      { "placement": "absent" },
"interaction": { "trigger": "tap", "tooltip": { "enabled": true, "placement": "fix" },
                 "crosshair": false, "brush": false, "zoom": false, "legendToggle": false },
"narrative":   { "summaryPhrase": false, "valueDisplay": "none", … },
"dataTable":   { "present": true, "disclosure": "button", "initiallyExpanded": false,
                 "columns": "all" },
"regionOrder": ["plot", "table"]
```

`valueLegibility: 'shape-only'` and `axes.y.visible: false` are the same fact stated at two altitudes,
and the CI assertion in §3 binds them.

### Panel (3×3 – 6×4)

```jsonc
"valueLegibility": "values",
"axes": {
  "x":  { "visible": true, "domainLine": true,
          "ticks": { "mode": "count", "count": 4 },   // width 420 → max(2, round(420/100)) = 4
          "title": false, "gridlines": false },
  "y":  { "visible": true, "domainLine": false,
          "ticks": { "mode": "count", "count": 4 },
          "title": false, "gridlines": true },
  "y2": null
},
"labels":      { "seriesLabels": "direct-end", "valueLabels": "none",
                 "axisLabelDegrade": "none", "maxChars": null },
"legend":      { "placement": "direct" },
"interaction": { "trigger": "hover", "tooltip": { "enabled": true, "placement": "fix" },
                 "crosshair": true, "brush": false, "zoom": false, "legendToggle": false },
"motion":      { "durationClass": "recompose", "stages": 2,
                 "persistGridlines": true, "objectConstancy": false }
```

`y.gridlines: true` with `x.gridlines: false` is §4's *"horizontal gridlines only"*. `stages: 2`
because both the axis rescales and marks move.

### Canvas (6×5 – 8×6)

Differs from Panel:

```jsonc
"axes": { "y": { …, "title": true }, … },
"marks":  { "primary": { "kind": "line", "area": false }, "points": { "mode": "all" }, … },
"legend": { "placement": "external", "position": "right", "maxEntries": 8,
            "showValues": false, "showPercent": false },   // only when series > 4
"interaction": { "trigger": "hover", "tooltip": { "enabled": true, "placement": "fluid" },
                 "crosshair": true, "brush": false, "zoom": false, "legendToggle": true },
"regionOrder": ["plot", "legend", "table"]
```

⚠ `legend` is **conditional on `shape.series > 4`** (§4 Canvas: *"legend if > 4 series"*). At ≤ 4
series it stays `{ "placement": "direct" }`. This is the non-monotonic rule doing real work: Canvas
does not automatically have *more* legend than Panel.

`placement: 'external'` shrinks the plot area inside the box — it never widens the widget (§1.3).

### Stage (9×6 – 12×8+)

Differs from Canvas:

```jsonc
"axes": { "y2": { "visible": true, "domainLine": false,
                  "ticks": { "mode": "count", "count": 4 },
                  "title": true, "gridlines": false }, … },
"labels":    { "seriesLabels": "direct-end", "valueLabels": "extrema", … },
"narrative": { "summaryPhrase": false, "valueDisplay": "none", "valueTypeScale": 12,
               "deltaBasis": false, "callouts": "extrema",
               "annotations": true, "thresholdBands": true },
"interaction": { "trigger": "hover", "tooltip": { "enabled": true, "placement": "fluid" },
                 "crosshair": true, "brush": true, "zoom": true, "legendToggle": true }
```

⚠ **One thing Stage needs that the type does not currently express: small multiples.** §4 Stage says
*"small multiples if series > 4"* — Kim et al.'s `serialize` action. That is not a mark change, an
axis change, or a legend change; it is a statement that the plot region subdivides into N sub-plots.

Rather than add a recursive plan (rejected in §3), add one flat field to `MarksPlan`:

```ts
readonly facet: { readonly mode: 'none' } | { readonly mode: 'series'; readonly columns: number };
```

`facet.mode: 'series'` with `columns` derived from aspect. Each facet renders the same plan minus its
legend. **Tier: B** — `serialize` is A-lit vocabulary (Kim et al., one of the most frequent strategies
in the corpus), the column count is ours. It is containment-safe: faceting subdivides the plot region
and cannot grow the box.

**All six rungs express. The type survives, with one field added (`marks.facet`) discovered by the
exercise** — which is precisely the value of doing this on paper before A3.

---

## 7. Donut, walked against the type

Stresses `aggregate` and the externalised legend.

| Rung | Expression | Verdict |
|---|---|---|
| Micro | `marks.primary: {kind:'none'}`, `narrative.valueDisplay: 'latest'` | ✅ identical shape to line Micro |
| Tile | `{kind:'arc', donut:true}`, all axes `OFF`, `legend: {placement:'absent'}`, `narrative.valueDisplay: 'latest'` (centre total) | ✅ |
| Panel (square) | `legend: {placement:'internal', maxEntries:8}` **or** `'absent'` | ✅ the non-monotonic enum earns itself here |
| Canvas (landscape) | `legend: {placement:'external', position:'left', showValues:true, showPercent:true}`, `aggregate: {after:8, minShare:0.02, otherBucket:true, …}`, `motion.objectConstancy: true` | ✅ matches the observed frame exactly: 8 named + `Other 19 (6%)` |
| Stage | `aggregate.expandable: true`, `labels.seriesLabels` → needs `'leader-line'` | ⚠ **gap** |

**One gap found.** §4 Stage: *"leader-line direct labels on large slices"*. `labels.seriesLabels` is
`'none' | 'direct-end'`, and `'direct-end'` is a line-chart concept. Widen to:

```ts
readonly seriesLabels: 'none' | 'direct-end' | 'leader-line';
```

**Tier: B.** Leader lines are standard practice; no perception citation was retrieved for them, and
none should be invented.

Two things the walk confirms rather than changes: `axes` being all-`OFF` for a whole chart type is
cheap (five booleans, no special case), and `aggregate` needed no donut-specific field.

---

## 8. KPI, walked against the type — the composition test

`10-responsive-ladder.md:237` calls KPI *"the proof that widget = composition, not a single mark."*

| Rung | Expression |
|---|---|
| Micro | `valueDisplay:'latest'`, `valueTypeScale:'fit'`, `marks.primary:{kind:'none'}`, `regionOrder:['value','table']` |
| Tile | `valueDisplay:'latest+delta'`, `deltaBasis:true`, `regionOrder:['value','table']` |
| Strip | `valueDisplay:'latest+delta'`, `marks.primary:{kind:'line'}`, `legend.position` implies side-by-side, `regionOrder:['value','plot','table']` |
| Panel | `valueDisplay:'latest+delta'`, `marks.primary:{kind:'bar',…}`, `axes.y.visible:true`, `regionOrder:['value','plot','table']` |

✅ **Composition needs no new machinery.** A KPI widget is a plan where the `value` region is present
*and* the `plot` region is present; `regionOrder` states the stacking. `NumberDisplay` and `TimeBar`
remain separate components, and the plan combines them by listing both regions — exactly what §4
asks for, with no recursion and no `ChartPlan`-inside-`ChartPlan`.

⚠ The Strip rung places the sparkline *beside* the value rather than below it, and `regionOrder` is
vertical-only (§3). Currently that arrangement is expressible only via `legend.position`, which is
wrong — there is no legend here. **Either** `regionOrder` gains a direction, **or** the side-by-side
case is left to CSS as pure presentation.

**Resolution: leave it to CSS.** Whether the value sits above or beside the sparkline changes no
information content — it is not a rung transition, it carries no `Recompose`/`Transpose` semantics,
and it is exactly the per-widget stylistic control `PRODUCT.md` promises from a stylesheet with no
re-render. Putting it in the plan would move a presentation decision across the server/client
boundary for no benefit. `regionOrder` stays a content order, not a layout direction.

---

## 9. Settled here: `prevClass` stays out of the resolver

`20-architecture.md` lists as open: *"Whether `prevClass` in the resolver is worth the purity cost.
Now leaning strongly no."* `10-responsive-ladder.md` §8 asks the same question.

**Settled: out.** `planChart()` is a pure function of `(type, ctx, shape, policy, overrides)` with no
memory of the previous size class. `ChartPlan` has no `prevClass` field and `SizeContext` gains none.

Three reasons, in order of weight:

1. **Containment already prevents the loop.** §1.1 — a deadband cannot save an unresolved cycle, it
   only slows it. Containment is the mechanism; hysteresis was never the primary one.
2. **Animation converts flicker into smear** (§7). A ~1 s eased transition makes a boundary crossed
   twice in a second read as one continuous motion.
3. **Purity is load-bearing twice over.** It is required by decision 7 for the server path, and
   `20-architecture.md` §6a makes it load-bearing for *testability* — the ladder is tested in bare
   Node with no DOM at all. A resolver with memory is a resolver with a setup step in every test.

✅ Decision 017 measured that flicker survives containment and animation. The shipped follow-up is
`resolveSizeClassWithDeadband()` in `@gx/core`, expressed as a **1% fraction of each family
minimum**, never absolute pixels. `AutoChart` owns the previous class and passes it into this pure
classifier; `PlanPolicy`, `ChartPlan` and `SizeContext` remain free of resolver state.

---

## 10. Amendments this document required elsewhere — ✅ all applied

| File | Current | Needs to become |
|---|---|---|
| `20-architecture.md:89` | `type ChartPlan = { /* see 10-responsive-ladder.md for the full field list */ };` | pointer to this document |
| `20-architecture.md` §3.1 | `planChart(type, ctx, shape, overrides?)` — 4 params | 5 params; `PlanPolicy` split from `PlanOverrides` (§5) |
| `20-architecture.md:109` | `<Chart plan={{ legend: 'hidden' }}>` | `legend: { placement: 'absent' }` (§4.4) |
| `10-responsive-ladder.md:52` | same stale shorthand | same fix |
| `20-architecture.md` §3.3 | *"Decide empirically during Milestone A, not now."* | `prevClass` decided out; revisit only if A5 shows flicker (§9) |
| `10-responsive-ladder.md` §8 item 2 | open question | resolved — cross-reference §9 |

---

## 11. Open, and deliberately not invented

1. **`facet.columns`** (§6) — no published basis for how many small-multiple columns a given aspect
   should produce. Tier C, and it should be driven by `categories-max-legible` plus measured cell
   width rather than a constant.
2. ~~**`valueTypeScale: 'fit'`** depends on `41-text-metrics.md` landing. Until `FontMetrics` exists,
   `'fit'` is unimplementable and KPI Micro cannot ship.~~ **Closed at A3, and the blocker turned out
   to be an artefact of resolving `'fit'` too early.** It was posed as *"fit type to a box"*, which
   does require measuring the value string — which the resolver never sees. Read instead as *"the
   renderer picks the largest size that fits within this reserved band"*, it dissolves: the band is
   decided from the box alone, the renderer fits within it, and the region provably cannot grow the
   box (§1.3). Nothing was measured and nothing was invented; the question was mis-scoped.
3. **Bar geometry** — §8 item 3: no published minimum bar width. Talbot, Setlur & Agrawala 2014 is
   the likely home; not retrieved. `marks.primary.kind: 'bar'` therefore carries no minimum-width
   field, rather than carrying an invented one.
4. **`labels.maxChars`** — the abbreviation budget follows from Talbot's 1.5 em spacing plus
   `measureText()`, but the *abbreviation strategy* (truncate, elide-middle, drop vowels, use a
   supplied short name) is unspecified and has no published ordering. Consumer-supplied short labels
   are almost certainly the right default; that is taste, and it should ship labelled C.

*Items 5–10 were found by implementing A3. Each is a place the implementation had to choose
something the corpus does not say, and each is labelled rather than smoothed over.*

5. **What makes Stage's secondary axis optional.** §4.1 calls `axes.y2` an *"optional secondary
   axis"* and §6 hand-authors it visible, but nothing published says what the option turns on — and
   the thing that actually justifies one is **two series in different units**, which `DataShape`
   cannot express. Tier **C**: the implementation ships it for multi-series shapes and omits it for
   single-series, because two axes against one series is indefensible at any size. A consumer who
   knows their units says `{ axes: { y2: null } }`; that is what overrides are for. The honest fix is
   a `DataShape` that carries units, which is a wider change than A3 should make.

6. **There is no height-driven y tick count, and inventing one would be worse than the gap.**
   `tickCountForWidth()` is Talbot 2010 — A-lit. Nothing published gives the vertical equivalent, so
   the implementation uses a constant `4`, which is `10-responsive-ladder.md` §4's range of 3–4 with
   its top picked: Tier **B**. Writing `round(height / k)` to mirror the horizontal formula would
   manufacture a Tier C number that reads exactly as authoritative as the A-lit one beside it, which
   is the specific failure the tier system exists to prevent.

7. **A Strip in an unusually short box.** §4 makes the encoding substitution conditional **only at
   Tile**, so a Strip whose plot falls under 24 px keeps its line. Heer 2009's finding applies to any
   plot of that height, not to a size class, so the rule is probably too narrow — but §4 does not say
   so, and generalising it silently would change three rungs on an inference. Tier **C** question;
   the implementation follows §4 as written. Resolving it needs either a re-read of Heer 2009's
   design or a decision recorded as ours.

8. **Canvas's label degradation departed from §6's literal text, and the departure was arithmetic —
   until the arithmetic changed again.** §6:640 gives Canvas no degradation; for a time the
   implementation abbreviated to 4 characters. Nothing in §6 changed either time — the earlier
   `'none'` was computed against a placeholder metrics table with zero per-character coverage, and
   with the real table, Canvas's plot measured 451.64 px across 5 tick slots: a 90.3 px slot, less
   1.5 em of mandated spacing, left a 73.83 px budget against a worst-case 5-character label at
   77.12 px — a 3.29 px overrun.
   
   ⚠ **That overrun is gone, and §6 is right again — not because it was re-read, but because a real
   gap closed underneath it.** `directLabelGutter()` (`./layout.ts`) now reserves right-side plot
   space for the direct-end series labels §6:615 already specifies for Panel and this rung inherits
   — space that plot-width arithmetic never charged for before, silently crowding the last data point
   against the widget's own edge. Reserving it honestly narrows the plot and drops Canvas to 3 tick
   slots at the same fixture width; 5 slots of the *old*, over-wide plot needed abbreviation, 3 slots
   of the *corrected* one do not (323.31 px / 3 ≈ 107.77 px slot, a 91.27 px budget against the same
   77.12 px worst case — comfortable, not close). §6's hand-authored value was written without a
   measurement available either time; this is what the measurement, corrected, now produces, and it
   happens to agree with §6 again. Full derivation in `packages/core/src/rungs/line.snapshot.test.ts`.

9. **`split` assumes a break opportunity exists.** The published degrade order is
   `abbreviate → split → rotate → axis-transpose`, but `DataShape` cannot say whether a label
   contains a space, and adding a `splittable` flag would be a field the resolver has no honest way
   to populate. A label with no break opportunity renders on one line and the renderer falls through
   to the next step. Correct behaviour, undocumented in the corpus, recorded here.

10. **`maxChars` is a floor on what fits, not a prediction of it.** Labels are measured as
    `'M'.repeat(n)` — the widest common Latin glyph — because `DataShape` carries a length and no
    strings. Real axis labels (`"Jan 1"`, `"2024"`) are mostly digits and narrow lowercase, so a
    chart whose labels are ordinary words abbreviates earlier than it strictly must. That is the
    direction `41-text-metrics.md` §6.1 mandates and the recoverable one. Fixing it needs the label
    text itself, and **a resolver that takes label text takes the data** — the plan-as-data split in
    §2 depends on it not doing so. So this is a gap that should probably stay open.
