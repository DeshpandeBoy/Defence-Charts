/**
 * The six line/area rungs.
 *
 * Transcribed from `research/40-chart-plan.md` §6, which hand-authors all six as JSONC
 * before any code existed — Micro at :542, Tile at :573, Strip at :592, Panel at :615,
 * Canvas at :640, Stage at :660. **This file invents as little as it can get away with.**
 * Where §6 elides a group as *"differs from …"*, the elided group is identical to the rung
 * above and is written out in full here, because §1.1 requires complete specs rather than
 * diffs. Where §6 is genuinely silent, a ⚠ says so and names the tier.
 *
 * ## Each rung is a total function of (ctx, shape, policy)
 *
 * One exported function per rung, each returning a whole `ChartPlan`. Not partials that get
 * merged: a rung returning a diff *is* the diff-shaped ladder §1.1 rejects, and it would
 * make the non-monotonic fields (`narrative.summaryPhrase`, `legend.placement`) inexpressible
 * without a subtract-on-grow operation.
 *
 * ## The order inside a rung
 *
 * Every rung runs the same four steps, and the order is the one §1.3 fixes:
 *
 *   1. Commit the chrome — axes, legend, value region, table disclosure.
 *   2. `resolvePlotBox()` — what is left for marks.
 *   3. `tickCountForWidth(plotBox.width)` — §1.3's third link.
 *   4. `degradeXLabels()` — §1.3's fourth link.
 *
 * ⚠ Step 3 writes a tick *count* back into an axis that step 2 already charged for, and
 * that is not a second pass. `xAxisBand()` charges a full tick-label line height whenever
 * the mode is not `'none'`, and the mode is decided in step 1 — so the count cannot move
 * the band that produced the width the count was derived from. The same holds for step 4.
 *
 * ## Thresholds
 *
 * Every threshold reads from the resolved `PlanPolicy`; there are no bare numbers in a
 * decision. Values that are only relevant to future chart families remain in `PlanPolicy`
 * as serialisable inputs, but are intentionally not forced into this line/area ladder.
 */

import type { DataShape, SizeContext } from './../context.ts'
import {
  degradeXLabels,
  resolvePlotBox,
  type ChromeSpec,
  type LabelDegrade,
  type PlotBox,
} from './../layout.ts'
import type {
  AggregatePlan,
  AxisPlan,
  ChartPlan,
  ChartType,
  DataTablePlan,
  FacetPlan,
  LegendPlan,
  MarkSpec,
  MarksPlan,
  RegionName,
  TickPlan,
} from './../plan.ts'
import { AXIS_OFF } from './../plan.ts'
import type { PlanPolicy } from './../policy.ts'
import { tickCountForWidth } from './../ticks.ts'

/** `'line'` and `'area'` share one ladder and differ only by `marks.primary.area` (§2). */
export type LineChartType = Extract<ChartType, 'line' | 'area'>

/** Everything a rung needs. Resolved policy, never a partial. */
export type RungInput = {
  readonly type: LineChartType
  readonly ctx: SizeContext
  readonly shape: DataShape
  readonly policy: PlanPolicy
}

/** A rung: total size context and data shape in, complete plan out. */
export type Rung = (input: RungInput) => ChartPlan

// --- Shared derivations ----------------------------------------------------------------

/**
 * `renderer` flips to canvas above the point budget — *"rather than dropping data; **never
 * silently sample**"* (§4.2). Tier **C**: a rendering threshold with no perceptual basis.
 */
function renderer(shape: DataShape, policy: PlanPolicy): MarksPlan['renderer'] {
  return shape.points > policy.pointBudget ? 'canvas' : 'svg'
}

/**
 * `regionOrder`, **derived rather than hand-authored**.
 *
 * §3 fixes the rule: *"A region is present iff its own group says so… `regionOrder` carries
 * only the ORDER, and lists only present regions."* Deriving it makes that a property of
 * the code instead of a promise repeated in six literals, and it reproduces all six of §6's
 * hand-authored arrays exactly — which is what the G9 snapshots check.
 *
 * ⚠ A `'direct'` or `'internal'` legend is **not** a region. Those live inside the plot, so
 * listing them would claim a band of the box that nothing occupies — and `legendBands()`
 * charges nothing for them, so the two would disagree.
 *
 * The canonical order — value, plot, legend, table — is the vertical chain of `./layout.ts`
 * read top to bottom. One order, one place.
 */
function regionOrder(
  valueDisplay: ChartPlan['narrative']['valueDisplay'],
  mark: MarkSpec,
  legend: LegendPlan,
  table: DataTablePlan,
): readonly RegionName[] {
  const regions: RegionName[] = []
  if (valueDisplay !== 'none') regions.push('value')
  if (mark.kind !== 'none') regions.push('plot')
  if (legend.placement === 'external') regions.push('legend')
  if (table.present) regions.push('table')
  return Object.freeze(regions)
}

/**
 * Line and area never aggregate. `after: null` is *"never"* spelled as a value (§1.4), not
 * `policy.aggregateAfter` left unapplied — §6 authors `null` at all six rungs because
 * bucketing a time series into "Other" is meaningless.
 */
function noAggregate(): AggregatePlan {
  return Object.freeze({
    after: null,
    minShare: null,
    otherBucket: false,
    expandable: false,
    temporalBin: 'none',
  })
}

const NO_FACET: FacetPlan = Object.freeze({ mode: 'none' })

/**
 * ⚠ `orientation` and `labels.axisLabelDegrade` carry the same fact, and §3 accepts that
 * deliberately: *"The two are bound by assertion rather than by construction."* This is the
 * construction side of that binding; `invariants.test.ts` is the assertion side.
 */
function orientationFor(degrade: LabelDegrade): ChartPlan['orientation'] {
  return degrade.step === 'axis-transpose' ? 'horizontal' : 'vertical'
}

/** Steps 2–4 of the rung order, for the rungs that have an x axis with tick labels. */
function resolveXLabels(
  x: AxisPlan,
  box: PlotBox,
  shape: DataShape,
  policy: PlanPolicy,
): { readonly ticks: TickPlan; readonly degrade: LabelDegrade } {
  if (x.ticks.mode !== 'count') {
    return { ticks: x.ticks, degrade: degradeXLabels(x.ticks, box.width, shape.labelMaxChars, policy) }
  }
  const ticks: TickPlan = Object.freeze({
    mode: 'count',
    count: tickCountForWidth(box.width, policy),
  })
  return { ticks, degrade: degradeXLabels(ticks, box.width, shape.labelMaxChars, policy) }
}

// --- Micro (1×1) — research/40-chart-plan.md:542 ---------------------------------------

/**
 * *"One number, one word of context, no plot."*
 *
 * The rung that most justifies §1.1: `narrative.summaryPhrase` is `true` **here and nowhere
 * else**, so the ladder's maximum for that field is at its smallest rung. A diff-shaped
 * type cannot express that without a subtract-on-grow operation (Kim et al.).
 *
 * ⚠ `dataTable.present` is `true` even at 1×1, and the disclosure is `'widget-tap'` rather
 * than a button. §5.4 — *"whole widget is one tap target"* — which is what keeps this from
 * colliding with the Conceal Means Gone Rule: nothing is hidden, because no separate
 * affordance renders at all.
 */
export const microRung: Rung = ({ type, ctx, shape, policy }) =>
  Object.freeze({
    type,
    sizeClass: ctx.sizeClass,
    // No plot at all, so no plot to read values off. A-lit boundary, B reification.
    valueLegibility: 'single-value',
    orientation: 'vertical',
    regionOrder: Object.freeze<RegionName[]>(['value', 'table']),

    axes: Object.freeze({ x: AXIS_OFF, y: AXIS_OFF, y2: null }),
    marks: Object.freeze({
      primary: Object.freeze({ kind: 'none' }) as MarkSpec,
      points: Object.freeze({ mode: 'none', autoHideDensityThreshold: null }),
      pointBudget: policy.pointBudget,
      renderer: renderer(shape, policy),
      facet: NO_FACET,
    }),
    labels: Object.freeze({
      seriesLabels: 'none',
      valueLabels: 'none',
      axisLabelDegrade: 'none',
      maxChars: null,
      labelHalo: 'none',
    }),
    legend: Object.freeze({ placement: 'absent' }) as LegendPlan,
    interaction: Object.freeze({
      trigger: 'none',
      tooltip: Object.freeze({ enabled: false, placement: 'fix' }),
      crosshair: false,
      brush: false,
      zoom: false,
      legendToggle: false,
    }),
    narrative: Object.freeze({
      summaryPhrase: true,
      valueDisplay: 'latest',
      valueTypeScale: 'fit',
      deltaBasis: false,
      callouts: 'none',
      annotations: false,
      thresholdBands: false,
    }),
    aggregate: noAggregate(),
    dataTable: Object.freeze({
      present: true,
      disclosure: 'widget-tap',
      initiallyExpanded: false,
      columns: 'summary',
    }),
    motion: Object.freeze({
      durationClass: 'recompose',
      stages: 1,
      persistGridlines: false,
      objectConstancy: false,
    }),
  })

// --- Tile (2×1 – 2×2) — research/40-chart-plan.md:573 -----------------------------------

/**
 * *"Value, delta, sparkline."*
 *
 * ⚠ **The one rung whose mark kind is decided by measured pixels rather than by size
 * class** — §6: *"all driven by measured plot height rather than by size class, which is why
 * `sizeClass` alone is not sufficient input to the resolver, and why `SizeContext` carries
 * raw px."* Three states from one rung:
 *
 * | Plot height             | Mark                  | Source                        |
 * |-------------------------|-----------------------|-------------------------------|
 * | ≥ `plotHeightOptimal`   | `line`                | 24 px optimal — Heer 2009     |
 * | ≥ `horizonMinHeight`    | `horizon`, 1 band     | below 24 px **change encoding** — Heer 2009 |
 * | below that              | `none`                | 6 px floor — Heer 2009        |
 *
 * The 24 px switch is a `replace`, not a `rescale`: the mark *kind* changes, which is why
 * `MarkSpec` is a discriminated union and not a shape with optional fields.
 *
 * ⚠ Both transitions are gated by `policy.substitute`. A consumer who pins substitution off
 * gets a line at every height, including heights where it is unreadable — that is their
 * decision to make, and it is a *policy* decision rather than an override precisely because
 * it changes how the resolver decides rather than what it decided (§5).
 *
 * ⚠ There is no `sparkline` mark kind and there will not be one (§4.2). A sparkline is a
 * line with every axis off, which `axes` already says.
 */
export const tileRung: Rung = ({ type, ctx, shape, policy }) => {
  // 1. Chrome. Every axis is off here, which is exactly why the height-conditional mark
  //    below is not circular — see the `./layout.ts` docblock.
  const chrome: ChromeSpec = {
    x: AXIS_OFF,
    y: AXIS_OFF,
    y2: null,
    legend: { placement: 'absent' },
    valueDisplay: 'latest+delta',
    valueTypeScale: 'fit',
    tableDisclosure: 'widget-tap',
    tablePresent: true,
  }

  // 2. Plot box, then the mark.
  const box = resolvePlotBox(ctx, chrome, shape.series, policy)
  const primary = tileMark(box.height, type, policy)

  const legend: LegendPlan = Object.freeze({ placement: 'absent' })
  const dataTable: DataTablePlan = Object.freeze({
    present: true,
    disclosure: 'widget-tap',
    initiallyExpanded: false,
    columns: 'summary',
  })

  return Object.freeze({
    type,
    sizeClass: ctx.sizeClass,
    valueLegibility: 'single-value',
    orientation: 'vertical',
    // Collapses to Micro's `['value', 'table']` when the plot vanishes, without a special
    // case — §6: *"the rung degenerates to Micro's shape while keeping Tile's valueDisplay."*
    regionOrder: regionOrder('latest+delta', primary, legend, dataTable),

    axes: Object.freeze({ x: AXIS_OFF, y: AXIS_OFF, y2: null }),
    marks: Object.freeze({
      primary,
      points: Object.freeze({ mode: 'none', autoHideDensityThreshold: null }),
      pointBudget: policy.pointBudget,
      renderer: renderer(shape, policy),
      facet: NO_FACET,
    }),
    labels: Object.freeze({
      seriesLabels: 'none',
      valueLabels: 'none',
      axisLabelDegrade: 'none',
      maxChars: null,
      labelHalo: 'none',
    }),
    legend,
    interaction: Object.freeze({
      trigger: 'none',
      tooltip: Object.freeze({ enabled: false, placement: 'fix' }),
      crosshair: false,
      brush: false,
      zoom: false,
      legendToggle: false,
    }),
    narrative: Object.freeze({
      // ⚠ `false` here and `true` at Micro. The non-monotonic field, one rung apart.
      summaryPhrase: false,
      valueDisplay: 'latest+delta',
      valueTypeScale: 'fit',
      deltaBasis: false,
      callouts: 'none',
      annotations: false,
      thresholdBands: false,
    }),
    aggregate: noAggregate(),
    dataTable,
    motion: Object.freeze({
      durationClass: 'recompose',
      stages: 1,
      persistGridlines: false,
      objectConstancy: false,
    }),
  })
}

/** Tile's three mark states. Extracted so the two thresholds sit side by side. */
function tileMark(plotHeight: number, type: LineChartType, policy: PlanPolicy): MarkSpec {
  const line: MarkSpec = Object.freeze({ kind: 'line', area: type === 'area' })
  if (!policy.substitute) return line
  if (plotHeight >= policy.plotHeightOptimal) return line
  if (plotHeight >= policy.horizonMinHeight) {
    // ⚠ One band, not `horizonMaxBands`. Heer 2009 caps bands at 3 but measures a 2-band
    // horizon as readable at 6 px; §6 authors 1 here because a Tile's plot is a sparkline's
    // worth of height and banding it further trades legibility for precision nobody can use
    // at this size. The cap is a finding; the choice within it is Tier B.
    return Object.freeze({ kind: 'horizon', bands: 1 })
  }
  return Object.freeze({ kind: 'none' })
}

// --- Strip (3×1 – 4×2) — research/40-chart-plan.md:592 ----------------------------------

/**
 * *"Shape, not values."*
 *
 * ⚠ `valueLegibility: 'shape-only'` is the honesty claim doing real work. A mark is drawn
 * and the chart explicitly does **not** claim a reader can estimate values from it — so
 * `axes.y` stays off, and gate **G12** asserts that pairing rather than trusting it.
 *
 * ⚠ `ticks: { mode: 'endpoints' }` is a distinct state from `{ mode: 'count', count: 2 }`
 * and collapsing them would silently upgrade this rung to value-legible (§4.1). Endpoints
 * label the *extent of the data*; two Talbot ticks label a *readable scale*.
 *
 * ⚠ The data table's disclosure becomes a `'button'` here, and the table is where this
 * rung's numbers actually live — §4.8's inversion: the table matters most exactly where
 * `valueLegibility` is weakest.
 */
export const stripRung: Rung = ({ type, ctx, shape, policy }) => {
  const x: AxisPlan = Object.freeze({
    visible: true,
    domainLine: true,
    ticks: Object.freeze({ mode: 'endpoints' }) as TickPlan,
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

  const legend: LegendPlan = Object.freeze({ placement: 'absent' })
  const dataTable: DataTablePlan = Object.freeze({
    present: true,
    disclosure: 'button',
    initiallyExpanded: false,
    columns: 'all',
  })

  const chrome: ChromeSpec = {
    x,
    y: AXIS_OFF,
    y2: null,
    legend,
    valueDisplay: 'none',
    valueTypeScale: 'fit',
    tableDisclosure: 'button',
    tablePresent: true,
  }
  const box = resolvePlotBox(ctx, chrome, shape.series, policy)
  const degrade = degradeXLabels(x.ticks, box.width, shape.labelMaxChars, policy)

  const primary: MarkSpec = Object.freeze({ kind: 'line', area: type === 'area' })

  return Object.freeze({
    type,
    sizeClass: ctx.sizeClass,
    valueLegibility: 'shape-only',
    orientation: orientationFor(degrade),
    regionOrder: regionOrder('none', primary, legend, dataTable),

    axes: Object.freeze({ x, y: AXIS_OFF, y2: null }),
    marks: Object.freeze({
      primary,
      points: Object.freeze({ mode: 'none', autoHideDensityThreshold: null }),
      pointBudget: policy.pointBudget,
      renderer: renderer(shape, policy),
      facet: NO_FACET,
    }),
    labels: Object.freeze({
      seriesLabels: 'none',
      valueLabels: 'none',
      axisLabelDegrade: degrade.step,
      maxChars: degrade.maxChars,
      labelHalo: 'none',
    }),
    legend,
    interaction: Object.freeze({
      // Tap, not hover: the first rung with a tooltip is also the first that must work on
      // a touch device without one. `placement: 'fix'` is Kim et al.'s documented strategy.
      trigger: 'tap',
      tooltip: Object.freeze({ enabled: true, placement: 'fix' }),
      crosshair: false,
      brush: false,
      zoom: false,
      legendToggle: false,
    }),
    narrative: Object.freeze({
      summaryPhrase: false,
      valueDisplay: 'none',
      // ⚠ Inert while `valueDisplay` is `'none'`, and spelled anyway. §1.4: a field's
      // absence is spelled as a value, never as a missing key, or the round-trip through
      // JSON stops being provably lossless.
      valueTypeScale: 'fit',
      deltaBasis: false,
      callouts: 'none',
      annotations: false,
      thresholdBands: false,
    }),
    aggregate: noAggregate(),
    dataTable,
    motion: Object.freeze({
      durationClass: 'recompose',
      stages: 1,
      persistGridlines: false,
      objectConstancy: false,
    }),
  })
}

/**
 * Line/area Strip presentation: keep the shared shape-only rung honest while making its
 * multiple coloured lines interpretable. Other families reuse `stripRung` as their chrome
 * seed and retain their own family-specific legend decisions.
 */
const lineStripRung: Rung = (input) => {
  const base = stripRung(input)
  return Object.freeze({
    ...base,
    legend: Object.freeze({
      placement: 'internal',
      maxEntries: input.policy.legendMaxEntries,
    }),
  })
}

// --- Panel (3×3 – 6×4) — research/40-chart-plan.md:615 ----------------------------------

/**
 * *"A real chart."* The first rung that claims value legibility, and therefore the first
 * that must carry a y axis — that implication is gate **G12**, run in the direction that
 * catches the dishonest plan: `valueLegibility !== 'values' → !axes.y.visible`.
 *
 * ⚠ The y axis has `domainLine: false` and `gridlines: true`, which is not an oversight.
 * Gridlines are the landmarks a reader traces to a label; a domain rule beside them is ink
 * that adds nothing. `motion.persistGridlines` becomes `true` at the same rung for the same
 * reason — *"do not remove and redraw"* (Heer & Bostock 2010).
 *
 * ⚠ `legend.placement: 'direct'` and `labels.seriesLabels: 'direct-end'` state one fact from
 * two sides: the legend at this rung *is* the end-of-line labels. They separate at Canvas.
 */
export const panelRung: Rung = (input) => valueLegibleRung(input, 'panel')

// --- Canvas (6×5 – 8×6) — research/40-chart-plan.md:640 ---------------------------------

/**
 * *"Room for content, not more plot."* Past 80 px of plot height extra space buys content
 * (Heer & Bostock 2010) — which is the empirical justification for the whole library.
 *
 * ⚠ **The legend is conditional on `shape.series > policy.directLabelMaxSeries`, and at
 *   or below it stays `'direct'`.**
 * §4.4's non-monotonic rule: Canvas does not automatically have *more* legend than Panel.
 * A monotonic model gets this wrong at both ends of the ladder.
 *
 * ⚠ `seriesLabels` stays `'direct-end'` even when the external legend appears, and that is
 * not the redundancy it looks like. Canvas is also the first rung with
 * `interaction.legendToggle: true` — so the external legend is an interactive *control*
 * while the end-of-line labels remain the identification device. Two jobs, two elements.
 */
export const canvasRung: Rung = (input) => valueLegibleRung(input, 'canvas')

// --- Stage (9×6 – 12×8+) — research/40-chart-plan.md:660 --------------------------------

/**
 * *"Everything the data supports."* Annotations, threshold bands, extrema callouts, brush
 * and zoom, and small multiples past four series.
 *
 * ⚠ `marks.facet` was discovered by hand-authoring this rung, not by designing the type
 * (§4.2): *"small multiples if series > 4"* is not a mark, axis or legend change, it is a
 * statement that the plot region subdivides. Each facet renders the same plan minus its
 * legend, which is what keeps the plan flat instead of recursive.
 *
 * ⚠ `axes.y2` is described by §4.1 as an *"optional secondary axis"* and §6 hand-authors it
 * visible — but **nothing published says what makes it optional**, and `DataShape` cannot
 * express the thing that actually justifies one (two series in different units). Tier **C**:
 * this ships it for multi-series shapes and omits it for single-series, because two axes
 * against one series is indefensible at any size. A consumer who knows better says
 * `{ axes: { y2: null } }` — that is exactly what overrides are for. Recorded in §11.
 */
export const stageRung: Rung = (input) => valueLegibleRung(input, 'stage')

// --- The three value-legible rungs -----------------------------------------------------

/**
 * Panel, Canvas and Stage share a spine — §6 authors Canvas and Stage as *"differs from"*
 * the rung above — so they are one function keyed by rung rather than three near-copies.
 *
 * ⚠ This is **not** the diff-shaped ladder §1.1 rejects. The rejected thing is a *type*
 * whose fields mean "inherit from the smaller rung"; every branch here still produces a
 * total `ChartPlan`, and the G9 snapshots read the whole plan at every rung. Sharing the
 * code that builds three total values is not the same as making the values partial.
 */
function valueLegibleRung(
  { type, ctx, shape, policy }: RungInput,
  rung: 'panel' | 'canvas' | 'stage',
): ChartPlan {
  const atLeastCanvas = rung !== 'panel'
  const isStage = rung === 'stage'
  const manySeries = shape.series > policy.directLabelMaxSeries

  const yTicks: TickPlan = Object.freeze({
    mode: 'count',
    count: Math.max(policy.ticksMin, policy.yTickCount),
  })

  const y: AxisPlan = Object.freeze({
    visible: true,
    domainLine: false,
    ticks: yTicks,
    // The axis title arrives at Canvas, where there is finally room for it.
    title: atLeastCanvas,
    gridlines: true,
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

  // See the `stageRung` docblock: Tier C, and deliberately not the direct-label threshold.
  const y2: AxisPlan | null =
    isStage && shape.series >= policy.secondaryAxisMinSeries
      ? Object.freeze({
          visible: true,
          domainLine: false,
          ticks: yTicks,
          title: true,
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
      : null

  const legend: LegendPlan =
    atLeastCanvas && manySeries
      ? Object.freeze({
          placement: 'external',
          position: 'right',
          maxEntries: policy.legendMaxEntries,
          showValues: false,
          showPercent: false,
        })
      : Object.freeze({ placement: 'direct' })

  const dataTable: DataTablePlan = Object.freeze({
    present: true,
    disclosure: 'button',
    initiallyExpanded: false,
    columns: 'all',
  })

  // 1. Chrome — the x axis's tick *mode* is fixed here; only its count is decided later.
  const xProvisional: AxisPlan = Object.freeze({
    visible: true,
    domainLine: true,
    ticks: Object.freeze({ mode: 'count', count: policy.ticksMin }) as TickPlan,
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

  const chrome: ChromeSpec = {
    x: xProvisional,
    y,
    y2,
    legend,
    valueDisplay: 'none',
    valueTypeScale: isStage ? 12 : 'fit',
    tableDisclosure: 'button',
    tablePresent: true,
  }

  // 2–4. Plot box, tick count, label degradation.
  const box = resolvePlotBox(ctx, chrome, shape.series, policy)
  const { ticks, degrade } = resolveXLabels(xProvisional, box, shape, policy)
  const x: AxisPlan = Object.freeze({ ...xProvisional, ticks })

  const primary: MarkSpec = Object.freeze({ kind: 'line', area: type === 'area' })

  const facet: FacetPlan =
    isStage && manySeries
      ? Object.freeze({ mode: 'series', columns: facetColumns(ctx, shape, policy) })
      : NO_FACET

  return Object.freeze({
    type,
    sizeClass: ctx.sizeClass,
    valueLegibility: 'values',
    orientation: orientationFor(degrade),
    regionOrder: regionOrder('none', primary, legend, dataTable),

    axes: Object.freeze({ x, y, y2 }),
    marks: Object.freeze({
      primary,
      // Points appear at Canvas: below it they are noise, at it they are readable targets.
      points: Object.freeze({
        mode: atLeastCanvas ? 'all' : 'none',
        autoHideDensityThreshold: atLeastCanvas
          ? policy.pointAutoHideDensityThreshold
          : null,
      }),
      pointBudget: policy.pointBudget,
      renderer: renderer(shape, policy),
      facet,
    }),
    labels: Object.freeze({
      seriesLabels: 'direct-end',
      valueLabels: isStage ? 'extrema' : 'none',
      axisLabelDegrade: degrade.step,
      maxChars: degrade.maxChars,
      labelHalo: 'none',
    }),
    legend,
    interaction: Object.freeze({
      trigger: 'hover',
      // `'fluid'` from Canvas up — Kim et al.'s `fix tooltip position` is a small-size
      // strategy, and there is room to track the pointer here.
      tooltip: Object.freeze({ enabled: true, placement: atLeastCanvas ? 'fluid' : 'fix' }),
      crosshair: true,
      brush: isStage,
      zoom: isStage,
      legendToggle: atLeastCanvas,
    }),
    narrative: Object.freeze({
      summaryPhrase: false,
      valueDisplay: 'none',
      // ⚠ Stage authors a px size where the rungs below author `'fit'`, and both are inert
      // while `valueDisplay` is `'none'`. Transcribed from §6 rather than normalised: a
      // value that looks arbitrary is easier to argue with than one quietly harmonised.
      valueTypeScale: isStage ? 12 : 'fit',
      deltaBasis: false,
      callouts: isStage ? 'extrema' : 'none',
      annotations: isStage,
      thresholdBands: isStage,
    }),
    aggregate: noAggregate(),
    dataTable,
    motion: Object.freeze({
      durationClass: 'recompose',
      // Two stages from Panel up: axis and ticks first, then marks. Never more than two.
      stages: 2,
      persistGridlines: true,
      objectConstancy: false,
    }),
  })
}

/**
 * Small-multiple column count.
 *
 * ⚠ **Tier C, and `research/40-chart-plan.md` §11 item 1 says so:** there is no published
 * basis for a facet column count, and it *"should be driven by categories-max-legible plus
 * measured cell width rather than a constant."* This is the labelled constant, not that
 * formula. It keys off aspect because a facet grid's shape is the one thing aspect obviously
 * governs, and it never exceeds the series count, because a column with no facet in it is
 * whitespace pretending to be structure.
 */
function facetColumns(ctx: SizeContext, shape: DataShape, policy: PlanPolicy): number {
  const byAspect = policy.facetColumnsByAspect[ctx.aspect]
  return Math.max(1, Math.min(shape.series, byAspect))
}

// --- Dispatch --------------------------------------------------------------------------

/**
 * `SizeClass` → rung. Total over the union, so a new family cannot be added to `SizeClass`
 * without the compiler pointing at this table.
 */
export const LINE_RUNGS: Readonly<Record<ChartPlan['sizeClass'], Rung>> = Object.freeze({
  micro: microRung,
  tile: tileRung,
  strip: lineStripRung,
  panel: panelRung,
  canvas: canvasRung,
  stage: stageRung,
})
