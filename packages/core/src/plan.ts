/**
 * `ChartPlan` — the public contract of the whole library.
 *
 * Transcribed from `research/40-chart-plan.md` §2–§4, which is a settled document: field
 * list, per-field provenance tier, and all six line/area rungs hand-authored before any
 * code existed. This file invents nothing. Where a decision looks arguable, the argument
 * has already happened and the ⚠ note says where.
 *
 * Four constraints from §1 govern every declaration below. They are acceptance criteria,
 * not style preferences, and three of the four are violated by the obvious design:
 *
 *   §1.1  Per-rung COMPLETE SPECS, not diffs. No field is optional-meaning-inherit.
 *         A `ChartPlan` is total — every field has a value at every rung. Kim et al.'s
 *         378-pair corpus documents content appearing only at SMALL size, which a
 *         diff-shaped type cannot express without a subtract-on-grow operation.
 *
 *   §1.2  Invertible. The naming rule that falls out: no field may be named for an
 *         action; every field names a STATE. `legend.placement`, never `legend.hidden`.
 *         `marks.points.mode`, never `dropPoints`. An action-named field encodes a
 *         direction of travel, and a type that encodes direction cannot be inverted
 *         without a second, mirror-image vocabulary.
 *
 *   §1.3  Containment. Every field describes a subdivision of, or an element inside, the
 *         measured box. NO FIELD NAMES AN OUTER DIMENSION — there is no `width`, no
 *         `height`, no widget margin. A plan field that could change the size of the box
 *         being measured is the infinite `ResizeObserver` loop.
 *
 *   §1.4  Plain and serialisable. The plan must survive
 *         `JSON.parse(JSON.stringify(plan))` unchanged or the server and client paths in
 *         decision 7 cannot be proven identical. No functions, no class instances, no
 *         `Date`, no `Map`, no `Set`, no `undefined`. Absence is SPELLED — `null` for
 *         "no secondary axis", `'none'` for "no points" — never a missing key, because
 *         `undefined` and "key absent" are indistinguishable after a round-trip.
 *
 * ⚠ `readonly` is on every field for a reason beyond taste. The plan is snapshot-tested
 * in isolation and transmitted server to client without its inputs; a mutable plan is one
 * that can be edited between those two points and still look like the resolver's output.
 */

// --- Size and type -------------------------------------------------------------------

/**
 * The six size families, named after the information budget rather than the pixels
 * (`research/10-responsive-ladder.md` §3).
 *
 * ⚠ These are anchored to published plot-height results, which is what stops them being
 * arbitrary: 6 px (2-band horizon still readable, Heer 2009), 24 px (optimal for line;
 * below this CHANGE ENCODING, Heer 2009), 40 px (below this value-estimation error rises
 * significantly, p < 0.001, Heer & Bostock 2010), 80 px (little benefit beyond, Heer &
 * Bostock 2010). See `resolveSizeClass()` in `./context.ts`.
 */
export type SizeClass = 'micro' | 'tile' | 'strip' | 'panel' | 'canvas' | 'stage'

/**
 * `research/40-chart-plan.md` §2.
 *
 * `'area'` resolves to the same ladder as `'line'` and differs only by
 * `marks.primary.area`. It stays a distinct type because consumers reach for it by name,
 * and because the resolver may legitimately choose different defaults — an area chart's
 * baseline makes `shape.hasNegative` matter more.
 *
 * ⚠ `'pie'` is deliberately absent. It is a presentation variant of `'donut'`, not a
 * type: one token (`--shiftcharts-donut-inner-radius`) at `0`.
 */
export type ChartType =
  | 'line'
  | 'area'
  | 'bar'
  | 'timebar'
  | 'donut'
  | 'scatter'
  | 'funnel'
  | 'kpi'
  | 'heatmap'
  | 'progress'

/**
 * The honesty field (`research/40-chart-plan.md` §3).
 *
 * | Value            | Meaning                                                  | Rungs               |
 * |------------------|----------------------------------------------------------|---------------------|
 * | `single-value`   | No plot to read from. One number is stated outright.      | Micro, Tile         |
 * | `shape-only`     | A mark is drawn but the chart does NOT claim a reader can | Strip               |
 * |                  | estimate values from it.                                  |                     |
 * | `values`         | The chart claims value legibility, and must carry a y-axis. | Panel, Canvas, Stage |
 *
 * ⚠ This is the field most worth arguing about, because it is the library's central
 * honesty claim made machine-checkable: *an axis a reader cannot read values off is a
 * promise the chart cannot keep* (`DESIGN.md`). Gate **G12** is the one-line assertion
 * `valueLegibility !== 'values' → !axes.y.visible`, which is the cheapest possible guard
 * on the thesis.
 *
 * Tier: **B**. The 40 px boundary is A-lit (Heer & Bostock 2010); reifying it as a
 * three-valued field is ours.
 */
export type ValueLegibility = 'values' | 'shape-only' | 'single-value'

/**
 * `research/40-chart-plan.md` §3 — composition without recursion.
 *
 * `research/10-responsive-ladder.md` calls this *"the proof that widget = composition,
 * not a single mark"*.
 *
 * ⚠ The obvious design is a recursive `ChartPlan` with child plans in slots. **Rejected**,
 * on two grounds: recursion makes the containment invariant (§1.3) unprovable — a nested
 * plan could specify a region size that grows its parent — and it makes snapshot diffs
 * unreadable at exactly the moment they matter.
 *
 * Instead: a flat plan with an explicit vertical stacking order. A region is present iff
 * its own group says so (`plot` iff `marks.primary.kind !== 'none'`, `value` iff
 * `narrative.valueDisplay !== 'none'`, and so on). `regionOrder` carries only the ORDER,
 * and lists only present regions.
 *
 * Side-by-side arrangement is NOT expressed here — it is carried by `legend.position`
 * (`'left'`/`'right'` imply side-by-side, `'top'`/`'bottom'` imply stacked). One fact,
 * one field.
 *
 * Tier: **C** — ours. No published source describes widget region ordering.
 */
export type RegionName = 'value' | 'plot' | 'legend' | 'table'

// --- 4.1 axes ------------------------------------------------------------------------

/**
 * ⚠ `'endpoints'` is a distinct mode, not `count: 2`. Two ticks chosen by Talbot's
 * algorithm land on NICE values; endpoints land on the FIRST AND LAST DATA POINTS, which
 * is a different claim — it labels the extent of the data, not a readable scale.
 * Collapsing them would silently upgrade Strip to a value-legible chart.
 *
 * ⚠ `ticksMin: 2` means `count` is never below 2 — but `mode: 'none'` is still reachable.
 * "At least two ticks IF THERE ARE TICKS" is not "there are always ticks".
 */
export type TickPlan =
  | { readonly mode: 'none' }
  | { readonly mode: 'endpoints' }
  | { readonly mode: 'count'; readonly count: number }

export type AxisPlan = {
  readonly visible: boolean
  /** The axis rule itself, drawn independently of its ticks. */
  readonly domainLine: boolean
  readonly ticks: TickPlan
  readonly title: boolean
  readonly gridlines: boolean

  // Milestone B2: Granular control (Vega-Lite / Best-of)
  readonly labelFlush: boolean | number
  readonly labelBound: boolean | number
  readonly tickBand: 'center' | 'extent'
  readonly tickExtra: boolean
  readonly minExtent: number
  readonly maxExtent: number
  readonly translate: number
  readonly strokeCap: 'butt' | 'round' | 'square'
  readonly dashPhase: number
}

export type AxesPlan = {
  readonly x: AxisPlan
  readonly y: AxisPlan
  /** Stage only — *"optional secondary axis"*. `null`, never absent (§1.4). */
  readonly y2: AxisPlan | null
}

// --- 4.2 marks -----------------------------------------------------------------------

/**
 * ⚠ **There is no `sparkline` kind.** The Tile rung renders *"value + delta + sparkline"*,
 * but a sparkline is structurally a line with every axis off — which `axes` already says.
 * A `sparkline` kind would encode the same fact in two places, and two fields that must
 * agree are a bug surface, not a feature. A sparkline is an EMERGENT DESCRIPTION of a
 * plan, not a field in it.
 *
 * ⚠ The 24 px switch to `'horizon'` is a `replace`, not a `rescale` — the mark kind
 * changes. Below ~24 px plot height a line degrades measurably and the published fix is
 * to change encoding, not to shrink (Heer 2009).
 *
 * ⚠ Bar's `stacked` and `grouped` are independent booleans, so `{ stacked: true, grouped:
 * true }` is representable but not a state any resolver produces. `./frame.ts` resolves it
 * at read time — stacked wins, unconditionally — because it is the only place holding the
 * fully merged plan; policy/override precedence (§5, `./policy.ts`) settles everywhere else.
 */
export type MarkSpec =
  | { readonly kind: 'none' }
  | { readonly kind: 'line'; readonly area: boolean }
  | { readonly kind: 'horizon'; readonly bands: 1 | 2 | 3 }
  | { readonly kind: 'bar'; readonly stacked: boolean; readonly grouped: boolean }
  | { readonly kind: 'arc'; readonly donut: boolean }
  | { readonly kind: 'progress'; readonly orientation: 'horizontal' | 'radial' }
  | { readonly kind: 'point' }
  | { readonly kind: 'cell'; readonly bandStart: number; readonly bandEnd: number }
  | {
      readonly kind: 'funnel'
      readonly orientation: 'horizontal' | 'vertical'
      readonly detail: 'summary' | 'stages' | 'dropoff' | 'breakdown'
    }

export type PointPlan = { 
  readonly mode: 'none' | 'all' | 'extrema' 
  readonly autoHideDensityThreshold: number | null
}

/**
 * Small multiples — Kim et al.'s `serialize` action.
 *
 * ⚠ Discovered by hand-authoring the Stage rung (`research/40-chart-plan.md` §6), not by
 * designing the type: *"small multiples if series > 4"* is not a mark change, an axis
 * change, or a legend change. It is a statement that the plot region SUBDIVIDES into N
 * sub-plots. Adding it as one flat field avoids the recursive plan rejected in §3; each
 * facet renders the same plan minus its legend.
 *
 * Containment-safe: faceting subdivides the plot region and cannot grow the box.
 *
 * Tier: **B** — `serialize` is A-lit vocabulary; the column count is ours.
 */
export type FacetPlan =
  | { readonly mode: 'none' }
  | { readonly mode: 'series'; readonly columns: number }

export type MarksPlan = {
  readonly primary: MarkSpec
  readonly points: PointPlan
  /**
   * Above this many points, `renderer` switches to canvas rather than dropping data —
   * **never silently sample**.
   *
   * Tier: **C**. A rendering threshold with no perceptual basis; the ladder says so
   * explicitly rather than dressing it up.
   */
  readonly pointBudget: number
  readonly renderer: 'svg' | 'canvas'
  readonly facet: FacetPlan
}

// --- 4.3 labels ----------------------------------------------------------------------

/**
 * The published degradation order (`research/10-responsive-ladder.md` §5.2):
 * `abbreviate → split → rotate → axis-transpose`.
 *
 * Tier: **A-lit** for the first three (Talbot 2010 penalises rotation heavily — *"a last
 * resort"*); **B** for the final transpose step, which is ours.
 *
 * ⚠ This records the step REACHED, not the sequence applied. Steps are cumulative and
 * ordered, so the terminal step names the state — which keeps the field a state rather
 * than an action (§1.2).
 */
export type DegradeStep = 'none' | 'abbreviate' | 'split' | 'rotate' | 'axis-transpose'

export type LabelsPlan = {
  readonly seriesLabels: 'none' | 'direct-end'
  readonly valueLabels: 'none' | 'all' | 'extrema'
  readonly axisLabelDegrade: DegradeStep
  /** Abbreviation budget in characters. `null` = no abbreviation (§1.4: spelled, not absent). */
  readonly maxChars: number | null
  /**
   * Character budget for a `seriesLabels: 'direct-end'` label — `policy.directLabelMaxChars`,
   * used to keep the inward-anchored identity label compact. `null` when
   * `seriesLabels !== 'direct-end'` (§1.4). **Not `maxChars`**: that field is coupled to
   * `axisLabelDegrade` by an invariant
   * (`invariants.test.ts` §3 — non-`null` only when `axisLabelDegrade === 'abbreviate'`) and
   * means the *x-axis* tick-label budget specifically. A series name and an x-axis tick label
   * are different strings with different width constraints; giving them one field was the
   * original version of this budget, and it broke that invariant the moment a plot narrow
   * enough to abbreviate the x-axis also happened to carry direct-end labels.
   */
  readonly seriesLabelMaxChars: number | null
  readonly labelHalo: 'none' | 'light' | 'dark'
}

// --- 4.4 legend ----------------------------------------------------------------------

/**
 * The non-monotonic one.
 *
 * The published pattern is **externalise-at-large / internalise-or-add-at-small**. Legends
 * were observed being ADDED at small size, because a compact internal legend costs less
 * space than direct labels that do not fit.
 *
 * ⚠ **This is why `legend` cannot be a boolean, a scalar, or an enum ordered by size.** A
 * monotonic model produces the wrong layout at BOTH ends: it drops the legend at Micro
 * where it may be the only way to identify a series, and it keeps a cramped internal
 * legend at Stage where there is room outside the plot. This is one of only three places
 * the literature actively CONTRADICTED the first draft of the ladder.
 *
 * ⚠ `'absent'`, not `'hidden'` — the Conceal Means Gone Rule (`DESIGN.md`). A hidden
 * legend is still in the DOM and still in the accessibility tree; an absent one is not.
 * No string shorthand is provided: one concept with two spellings is the ambiguity §1.4
 * bans.
 *
 * `maxEntries: 8` is Tier **C** — no published number for legend capacity exists.
 */
export type LegendPlan =
  | { readonly placement: 'absent' }
  | { readonly placement: 'direct' }
  | {
      readonly placement: 'internal'
      readonly maxEntries: number
      /** Whether the internal legend is allowed to sit over marks or owns a band above them. */
      readonly flow?: 'overlay' | 'reserved' | undefined
    }
  | {
      readonly placement: 'external'
      readonly position: 'left' | 'right' | 'top' | 'bottom'
      readonly maxEntries: number
      readonly showValues: boolean
      readonly showPercent: boolean
    }

// --- 4.5 interaction -----------------------------------------------------------------

/**
 * `research/10-responsive-ladder.md` §5.4, which makes interaction a first-class Target
 * rather than an afterthought.
 *
 * | Rung           | `trigger` | `tooltip.placement` |
 * |----------------|-----------|---------------------|
 * | Micro / Tile   | `none`    | —                   |
 * | Strip          | `tap`     | `fix`               |
 * | Panel          | `hover`   | `fix`               |
 * | Canvas / Stage | `hover`   | `fluid`             |
 *
 * Tier: **A-lit** for the `fix`/`fluid` distinction — Kim et al.'s documented
 * `fix tooltip position` strategy. The first draft of the ladder had no tooltip placement
 * rule whatsoever.
 *
 * ⚠ `trigger: 'none'` at Micro/Tile does NOT mean the widget is inert. §5.4: *"Whole
 * widget is one tap target."* That is a shell/grid behaviour, not a chart behaviour, and
 * it is deliberately outside this plan — `@shiftcharts/grid` owns it. The plan describes what
 * happens INSIDE the box (§1.3).
 */
export type InteractionPlan = {
  readonly trigger: 'none' | 'tap' | 'hover'
  readonly tooltip: {
    readonly enabled: boolean
    readonly placement: 'fix' | 'fluid'
  }
  readonly crosshair: boolean
  readonly brush: boolean
  readonly zoom: boolean
  readonly legendToggle: boolean
}

// --- 4.6 narrative -------------------------------------------------------------------

export type NarrativePlan = {
  /**
   * ⚠ The single field that most justifies §1.1. It is `true` at Micro and `false`
   * everywhere else — a NON-MONOTONIC field whose maximum is at the smallest rung. A
   * diff-shaped ladder cannot express it without a subtract-on-grow operation, which is
   * precisely the structural assumption the literature contradicted.
   *
   * Tier: **A-lit** — Kim et al.'s small-size-only `add`.
   */
  readonly summaryPhrase: boolean
  readonly valueDisplay: 'none' | 'latest' | 'latest+delta'
  /**
   * Type size for the value region: a number in px, or `'fit'` to derive it from the box.
   *
   * ⚠ The only field requiring text measurement at plan time. It resolves through
  * `measureText()` and the atomic typography plan input (`./text.ts`), **never**
   * through the DOM (decision 10, gate G2). Containment-safe: type size is derived FROM
   * the box and cannot grow it, provided the value region clips rather than overflows.
   */
  readonly valueTypeScale: number | 'fit'
  /** The comparison basis beside a delta — `+1% (54.7K)`. Tier: A-impl, observed frame. */
  readonly deltaBasis: boolean
  readonly callouts: 'none' | 'extrema'
  readonly annotations: boolean
  readonly thresholdBands: boolean
}

// --- 4.7 aggregate -------------------------------------------------------------------

export type AggregatePlan = {
  /**
   * `aggregateAfter` — bucket into "Other" once categories exceed this. `null` = never
   * aggregate, which is every line/area rung.
   *
   * Tier: **B**. ⚠ The default of 8 is **legend scannability, not perception** — the
   * ladder is explicit that donuts survive to 24 categories. Do not cite this as a
   * perceptual limit.
   */
  readonly after: number | null
  /**
   * Slices below this share join "Other". Tier: **C** — the 2% minimum slice has no
   * published basis, and the ladder says so.
   */
  readonly minShare: number | null
  /**
   * ⚠ Carries an ANIMATION OBLIGATION, not just a rendering one: slices must visibly
   * converge into "Other". A silent relabel violates semantic correspondence (Heer &
   * Robertson 2007). That is why `motion.objectConstancy` exists as a separate field
   * rather than being inferred from this one.
   */
  readonly otherBucket: boolean
  readonly expandable: boolean
  readonly temporalBin: 'none' | 'daily' | 'weekly' | 'monthly'
}

/** Activity-heatmap information state, promoted from D5.1's family-local contract. */
export type HeatmapSemantics = {
  readonly range: 'total' | 'recent-weeks' | 'full-range'
  readonly weekdayLabels: 'none' | 'axis-intent' | 'spelled'
  readonly monthLabels: 'none' | 'axis-intent'
  readonly intensityLegend: 'none' | 'external'
  readonly cellValues: 'none' | 'hover'
  readonly streakAnnotations: 'none' | 'visible'
  readonly cellBudget: number
  readonly nominalCellFloorPx: number
  readonly nominalCellFloorTier: 'C'
  readonly accessibility: {
    readonly cellText: 'summary' | 'table' | 'table-and-hover'
    readonly keyboard: 'widget' | 'cells'
  }
}

/** Funnel information state, promoted from D6.1's family-local contract. */
export type FunnelSemantics = {
  readonly summary: 'none' | 'conversion'
  readonly stageLabels: 'none' | 'all'
  readonly stageValues: 'none' | 'all'
  readonly dropoff: 'none' | 'per-stage'
  readonly conversion: 'none' | 'overall' | 'relative'
  readonly accessibility: {
    readonly stageText: 'summary' | 'table' | 'table-and-mark'
    readonly keyboard: 'widget' | 'stages'
  }
}

// --- 4.8 dataTable -------------------------------------------------------------------

/**
 * The a11y rung. `research/20-architecture.md` treats the table as *"another rung of the
 * responsive ladder"* rather than a bolted-on accessibility feature — rendered in a
 * `<figcaption>` inside a `<figure>`, outside the `<svg>`.
 *
 * ⚠ **`present` is `true` at every rung, including Micro.** This is the second
 * non-monotonic group, and it INVERTS: the table matters most exactly where
 * `valueLegibility` is weakest. A Strip that explicitly does not claim value legibility
 * is the rung whose reader most needs the numbers.
 *
 * ⚠ `disclosure: 'widget-tap'` at Micro/Tile resolves what would otherwise be a conflict
 * with the Conceal Means Gone Rule. A 1×1 tile has no room for a toggle button, but a
 * visually-hidden-yet-present button is exactly the ghost element that rule bans. §5.4
 * supplies the answer — at those rungs the whole widget is one tap target — so no
 * separate affordance renders and nothing is concealed.
 *
 * ⚠ Containment (§1.3): the disclosure and the table must be DESCENDANTS of the measured
 * element, and expansion scrolls within the fixed box. A table rendered as a sibling
 * would grow the box on expand, which is the `ResizeObserver` loop.
 */
export type DataTablePlan = {
  readonly present: boolean
  readonly disclosure: 'button' | 'widget-tap'
  readonly initiallyExpanded: boolean
  readonly columns: 'all' | 'summary'
}

// --- 4.9 motion ----------------------------------------------------------------------

/**
 * ⚠ **There is deliberately no `enabled` field, and this is a correctness decision, not
 * an omission.** Respecting `prefers-reduced-motion` is required — but that is a CSS
 * media query, and *the server cannot read it*. A resolver field derived from it would
 * produce one plan on the server and a different plan on the client: a hydration mismatch
 * on every animated chart.
 *
 * The split that works: the PLAN carries the structural facts (how many stages, which
 * duration class, whether constancy is required); CSS decides whether the transition
 * runs. Note the polarity — animation is ADDED when no preference is expressed, never
 * REMOVED from an explicit one, so the still chart is the baseline artefact and the plan
 * is valid unanimated.
 */
export type MotionPlan = {
  /**
   * `'rescale'` ≈ 300 ms; `'recompose'` ≈ 1000 ms when marks move.
   *
   * Tier: **A-lit and A-impl at once** — Heer & Robertson 2007 measured ~1000 ms and
   * Adobe Spectrum ships `DRAW_IN_ANIMATION_DURATION_MS = 1000`. Independent agreement to
   * the millisecond; cite both.
   */
  readonly durationClass: 'rescale' | 'recompose'
  /** Stage 1 axis/ticks, stage 2 marks. **Never more than two.** Tier: A-lit. */
  readonly stages: 1 | 2
  /**
   * Persist gridlines through a tick-count change — *"they are the landmarks that make an
   * axis change comprehensible. Do not remove and redraw."* Tier: A-lit.
   */
  readonly persistGridlines: boolean
  readonly objectConstancy: boolean
}

// --- The plan ------------------------------------------------------------------------

/**
 * `research/40-chart-plan.md` §3.
 *
 * ⚠ `type` and `sizeClass` are echoed from the resolver's inputs deliberately: the plan
 * must be SELF-DESCRIBING, because it is snapshot-tested in isolation and transmitted
 * server to client without its inputs.
 *
 * ⚠ `orientation` duplicates a fact also carried by `labels.axisLabelDegrade`
 * (`'axis-transpose'` implies `'horizontal'`). **Accepted deliberately** — `orientation`
 * is needed by consumers that never inspect `labels`, and deriving it would make the plan
 * non-self-describing. The two are bound by assertion rather than by construction.
 */
export type ChartPlan = {
  /**
   * ⚠ **Wider than `ChartType` on purpose, and the two lists are not meant to agree.**
   * `planChart()`'s own `type` parameter stays the closed union: it resolves what it has a
   * rung set for and **throws** for everything else, naming the milestone. That throw is
   * deliberate — see `./plan-chart.ts`. A `ChartPlan`, though, is *data*, and the plan is
   * the extension point: `<Chart>` dispatches on `marks.primary.kind`, never on this
   * field, so a plan carrying `type: 'sankey'` renders exactly as well as its marks allow.
   *
   * *Two types, two jobs:* `planChart` accepts what it can **resolve**; `ChartPlan`
   * carries what anyone can **produce**. Closed here too, a third-party or paid planner
   * could not emit a valid plan without editing `@shiftcharts/core` — there would be no seam at
   * all. `research/60-commercial-model.md` §3 costs that out: two lines today, a major
   * version once D fills in the other eight types and first publish makes `ChartType` a
   * G6-guarded public surface. Worth doing even if no paid tier is ever built, because it
   * is also what lets a consumer write a bespoke chart type without forking.
   *
   * ⚠ `(string & {})` rather than a plain `string`, and the intersection is load-bearing:
   * `ChartType | string` reduces to `string` and takes the ten literals out of editor
   * autocomplete, which is most of what the union was for.
   *
   * ⚠ **A label, not a dispatch key.** It reaches the DOM as `data-chart-type` and is read
   * by themes, snapshots and tests. Anything that switches on it is a renderer that cannot
   * draw a type it has not heard of — the registry §3 rejects, wearing a `switch`.
   */
  readonly type: ChartType | (string & {})
  readonly sizeClass: SizeClass
  readonly valueLegibility: ValueLegibility
  readonly orientation: 'vertical' | 'horizontal'
  readonly regionOrder: readonly RegionName[]

  readonly axes: AxesPlan
  readonly marks: MarksPlan
  readonly labels: LabelsPlan
  readonly legend: LegendPlan
  readonly interaction: InteractionPlan
  readonly narrative: NarrativePlan
  readonly aggregate: AggregatePlan
  /** Present only for the registered heatmap family; null is reserved for explicit custom plans. */
  readonly heatmap?: HeatmapSemantics | null | undefined
  /** Present only for the registered funnel family; null is reserved for explicit custom plans. */
  readonly funnel?: FunnelSemantics | null | undefined
  readonly dataTable: DataTablePlan
  readonly motion: MotionPlan
}

/**
 * The all-off axis, which every rung below Strip uses for both `x` and `y`.
 *
 * Exported because the hand-authored rungs in `research/40-chart-plan.md` §6 elide it as
 * `OFF`, and a shared constant keeps the snapshot fixtures readable. Frozen because §1.4
 * requires the plan to be a value, and a shared mutable object would let one rung's
 * fixture edit another's.
 */
export const AXIS_OFF: AxisPlan = Object.freeze({
  visible: false,
  domainLine: false,
  ticks: Object.freeze({ mode: 'none' }) as TickPlan,
  title: false,
  gridlines: false,
  labelFlush: false,
  labelBound: false,
  tickBand: 'center',
  tickExtra: false,
  minExtent: 0,
  maxExtent: 0,
  translate: 0,
  strokeCap: 'butt',
  dashPhase: 0,
})
