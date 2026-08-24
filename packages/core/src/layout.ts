/**
 * The plot box — how much of the measured element is left for marks once the chrome has
 * taken its share.
 *
 * ⚠ **This module is the one place in A3 that the research corpus does not already
 * specify.** Everything else in the resolver is transcription;
 * `research/40-chart-plan.md` §6 hand-authors all six rungs and §1.3 fixes the horizontal
 * resolution order. But the corpus is silent on the vertical order, and A3 cannot proceed
 * without it: the Tile rung selects its mark kind by *measured plot height* (§6 Tile —
 * three mark states, *"all driven by measured plot height rather than by size class"*),
 * and nothing anywhere says how plot height is obtained from the widget box.
 *
 * So this file is **Tier B** in its entirety: the mechanism is ours, the numbers it
 * consumes are not. It is deliberately small, deliberately arithmetic, and deliberately
 * separate from `./rungs/` so that the one invented thing in the milestone sits in a file
 * of its own with its own argument attached.
 *
 * ## Why this is acyclic, and why that has to be written down
 *
 * It reads as a cycle: the mark kind depends on plot height, plot height depends on the
 * chrome, and the chrome is part of the plan. It is not a cycle, for a specific structural
 * reason — **at Tile, the one rung whose mark is height-conditional, no axes are present at
 * all.** `axes.x` and `axes.y` are both `AXIS_OFF`, so every band above and below the plot
 * is fixed by the rung before the mark is chosen. At every rung where axes *do* consume
 * space (Strip and up), the mark is unconditionally a line. The dependency graph is a DAG
 * because of what the ladder says, not because of how this file is written.
 *
 * ⚠ Do not "fix" this into a fixpoint. §1.3: *"The resolver is single-pass, and must stay
 * that way… a fixpoint inside a `ResizeObserver` callback is the loop error by another
 * route."* If a future rung genuinely needs feedback, the answer is to change the ladder,
 * not to iterate here.
 *
 * ## The two chains
 *
 * §1.3 specifies the horizontal one and this file implements it verbatim:
 *
 *     y gutter → plot width → x tick count → x label degrade
 *
 * The vertical one is ours, and mirrors it — outer bands first, plot last:
 *
 *     value region → x-axis band → legend band → table affordance → plot
 *
 * Both are single-pass. Neither re-enters.
 *
 * ## Containment
 *
 * Every number here is a *subtraction* from `ctx.width` / `ctx.height`. Nothing in this
 * module can produce a figure larger than the box it was given, which is §1.3's invariant
 * expressed as arithmetic rather than as a promise. `resolvePlotBox()` clamps at zero.
 */

import type { SizeContext } from './context.ts'
import type { AxisPlan, DegradeStep, LegendPlan, NarrativePlan, TickPlan } from './plan.ts'
import { type PlanPolicy, DEFAULT_POLICY } from './policy.ts'
import { measureText, RANK_FONT_SIZE, type TypeRank } from './text.ts'

/**
 * What the plot is left with, after chrome.
 *
 * ⚠ Not a `ChartPlan` field and never will be. §1.3: *"No field names an outer
 * dimension."* This is an intermediate the resolver computes and discards; it reaches the
 * plan only as the consequences it caused — a mark kind, a tick count, a degrade step.
 */
export type PlotBox = {
  /** px. */
  readonly width: number
  /** px. */
  readonly height: number
}

/**
 * The chrome a rung has already committed to, before it chooses its mark.
 *
 * Every field here is decided earlier in the rung than `marks.primary` is, which is what
 * makes the ordering safe. Passing the assembled `ChartPlan` instead would be circular by
 * construction and would invite exactly the fixpoint the module docblock rejects.
 */
export type ChromeSpec = {
  readonly x: AxisPlan
  readonly y: AxisPlan
  readonly y2: AxisPlan | null
  readonly legend: LegendPlan
  readonly valueDisplay: NarrativePlan['valueDisplay']
  readonly valueTypeScale: NarrativePlan['valueTypeScale']
  /** `'button'` renders a visible affordance and costs a band; `'widget-tap'` costs nothing. */
  readonly tableDisclosure: 'button' | 'widget-tap'
  readonly tablePresent: boolean
}

/**
 * ⚠ **Tier C, and local on purpose.** These four are rendering geometry: the length of a
 * tick mark, the gaps around it, and the weight of an axis rule.
 *
 * The same numbers, published so that the renderer draws chrome at the size the layout
 * reserved for it. 
 * 
 * ⚠ **This is not a token, and it must not become one before the layout math reads the token
 * too.**
 */
export const CHROME_METRICS = Object.freeze({
  tickLength: DEFAULT_POLICY.tickLength,
  tickLabelGap: DEFAULT_POLICY.tickLabelGap,
  axisTitleGap: DEFAULT_POLICY.axisTitleGap,
  axisRuleWidth: DEFAULT_POLICY.axisRuleWidth,
  regionGap: DEFAULT_POLICY.regionGap,
})

/**
 * ⚠ **Tier C, and the weakest number in this file.** The y gutter is the width of the
 * widest y tick label, but `DataShape` deliberately carries no data — *"the resolver never
 * sees values"* (`./context.ts`) — so there is no formatted domain to measure.
 *
 * This stands in for one: a signed, thousands-separated, one-decimal, unit-suffixed
 * number, which is the widest shape ordinary axis formatting produces. It **over-estimates
 * on purpose**, and the direction matters: a gutter that is too wide yields a narrower
 * plot, a lower x tick count, and sparser labels — visibly conservative. A gutter that is
 * too narrow clips the labels, which nothing in the test suite can see. Same asymmetry
 * `measureText()` is built around; see `./text.ts` §6.1.
 *
 * A4 can do better — the renderer knows the formatted domain and can measure it. Until
 * then this is the honest placeholder, not a measurement.
 */
const Y_TICK_LABEL_SAMPLE = '-1,234.5M'

/** Axis tick and tick labels are rank D (`research/42-typography.md` §2 — *"Align"*). */
const TICK_LABEL_RANK: TypeRank = 'D'
/** Axis titles are rank B (*"Title"*). */
const AXIS_TITLE_RANK: TypeRank = 'B'
/** Legend entries are rank C (*"Signal"*). */
const LEGEND_RANK: TypeRank = 'C'

// --- Bands -----------------------------------------------------------------------------

/**
 * Rendered line height for a type rank, in px.
 *
 * Derived from the vertical metrics that travel with the typography table rather than from
 * a separate line-height constant — `research/41-text-metrics.md` makes the metrics and the
 * rendered styles atomic, and a line height authored independently of them is the same
 * class of bug as a metrics table generated under the wrong feature settings.
 */
export function lineHeight(rank: TypeRank, policy: PlanPolicy): number {
  const v = policy.typography.metrics.vertical
  return (v.ascent + v.descent + v.lineGap) * RANK_FONT_SIZE[rank]
}

/**
 * Vertical space an axis consumes when it runs horizontally (the x axis).
 *
 * Order: rule → tick mark → gap → tick label → gap → title. A band that is not requested
 * contributes zero rather than a minimum, because `visible: false` is a state, not a
 * degraded state (§1.2).
 */
export function xAxisBand(axis: AxisPlan, policy: PlanPolicy): number {
  if (!axis.visible) return 0

  let band = axis.domainLine ? policy.axisRuleWidth : 0
  if (axis.ticks.mode !== 'none') {
    band += policy.tickLength + policy.tickLabelGap + lineHeight(TICK_LABEL_RANK, policy)
  }
  if (axis.title) band += policy.axisTitleGap + lineHeight(AXIS_TITLE_RANK, policy)
  return band
}

/**
 * Horizontal space an axis consumes when it runs vertically (y, and y2 on the far side).
 *
 * ⚠ This is §1.3's first link — *"y tick label widths set the y-axis gutter"* — and the
 * only place `measureText()` is called during layout. The near-cycle §1.3 warns about is
 * broken here by construction: the sample string is a constant, so the gutter cannot
 * depend on anything downstream of it.
 */
export function yAxisGutter(axis: AxisPlan | null, policy: PlanPolicy): number {
  if (axis === null || !axis.visible) return 0

  let gutter = axis.domainLine ? policy.axisRuleWidth : 0
  if (axis.ticks.mode !== 'none') {
    gutter +=
      policy.tickLength +
      policy.tickLabelGap +
      measureText(Y_TICK_LABEL_SAMPLE, TICK_LABEL_RANK, policy.typography.metrics)
  }
  // A vertical axis title is rotated, so it costs its LINE HEIGHT in width, not its
  // text length. Getting this the wrong way round is a ~10× error in the safe-looking
  // direction; it is called out because the mistake reads as correct.
  if (axis.title) gutter += policy.axisTitleGap + lineHeight(AXIS_TITLE_RANK, policy)

  if (axis.minExtent > 0) gutter = Math.max(gutter, axis.minExtent)
  if (axis.maxExtent > 0) gutter = Math.min(gutter, axis.maxExtent)
  return gutter
}

/**
 * The legend's cost, split by axis. `'left'`/`'right'` shrink the plot horizontally,
 * `'top'`/`'bottom'` vertically — the one fact `legend.position` carries (§3).
 *
 * ⚠ `'direct'` costs nothing here even though direct end-of-line labels plainly occupy
 * space. They occupy space *inside* the plot, beside the marks, so charging them against
 * the plot box would double-count. `'internal'` is the same case.
 *
 * `maxEntries` bounds the external band: a legend that grows with the series count could
 * consume the whole box, which is the containment failure §1.3 exists to prevent.
 */
export function legendBands(
  legend: LegendPlan,
  seriesCount: number,
  policy: PlanPolicy,
): { readonly width: number; readonly height: number } {
  if (legend.placement !== 'external') return { width: 0, height: 0 }

  const entries = Math.max(1, Math.min(seriesCount, legend.maxEntries))
  if (legend.position === 'left' || legend.position === 'right') {
    // Entries stack vertically in a column of fixed width. The width is a swatch plus a
    // label; the label is measured at the shape's own worst case rather than a sample,
    // because unlike a y tick label the resolver DOES know how long a series name is.
    const swatch = RANK_FONT_SIZE[LEGEND_RANK]
    const label = measureText(
      'M'.repeat(policy.legendMaxEntries),
      LEGEND_RANK,
      policy.typography.metrics,
    )
    return { width: policy.regionGap + swatch + policy.tickLabelGap + label, height: 0 }
  }
  return { 
    width: 0, 
    height: policy.regionGap + entries * lineHeight(LEGEND_RANK, policy) + Math.max(0, entries - 1) * policy.legendItemGap 
  }
}

/**
 * Height claimed by the value region.
 *
 * ⚠ **`'fit'` is resolved as a budget, not as a type size, and that is the point.**
 * `research/40-chart-plan.md` §11 records `valueTypeScale: 'fit'` as unimplementable until
 * a metrics table lands, on the grounds that fitting type to a box requires measuring the
 * value string — which the resolver never sees. Treating `'fit'` as *"the renderer picks
 * the largest size that fits within this reserved band"* dissolves that: the band is
 * decided from the box alone, the renderer fits within it, and the region provably cannot
 * grow the box. The blocker was an artefact of resolving 'fit' too early.
 *
 * `valueRegionMaxShare` is Tier **C** — ours, unsourced. It is a share rather than a px
 * figure so that it degrades sensibly at every rung instead of starving small ones.
 *
 * ⚠ **The share is charged whether or not the plot below it draws anything, and at Micro
 * it does not.** Observed at A4 by resizing the playground to 62 × 42: the value display
 * takes the top half, `marks.primary.kind` is `'none'`, and the bottom half is a plot with
 * nothing in it — half of the smallest rung in the ladder, reserved for marks that the
 * rung has already decided not to draw.
 *
 * It is left that way deliberately. The obvious fix — give the band the whole budget when
 * there are no marks — requires this function to know the mark kind, and at Tile the mark
 * kind is *decided from* the plot height this function helps produce. That is a re-entry
 * into the chain `resolvePlotBox()` is explicitly single-pass to avoid, and buying Micro
 * 20 px by making the resolution order circular is a bad trade. The honest fix is a
 * per-rung share, which is a policy-shape change and belongs with the token tree at B1.
 */
export function valueBand(
  valueDisplay: NarrativePlan['valueDisplay'],
  valueTypeScale: NarrativePlan['valueTypeScale'],
  boxHeight: number,
  policy: PlanPolicy,
): number {
  if (valueDisplay === 'none') return 0

  const budget = boxHeight * policy.valueRegionMaxShare
  if (valueTypeScale === 'fit') return budget

  const v = policy.typography.metrics.vertical
  const requested = (v.ascent + v.descent + v.lineGap) * valueTypeScale
  return Math.min(requested, budget)
}

/**
 * Height of the data-table affordance.
 *
 * ⚠ Only the *disclosure* is charged, never the table. §1.3: expansion scrolls within the
 * fixed box, so an expanded table costs the plot nothing it did not already cost.
 * `'widget-tap'` renders no separate control — §5.4's *"whole widget is one tap target"* —
 * so it is free, which is the same fact that lets Micro carry a table at all.
 */
export function tableBand(spec: ChromeSpec, policy: PlanPolicy): number {
  if (!spec.tablePresent || spec.tableDisclosure !== 'button') return 0
  return policy.regionGap + lineHeight(TICK_LABEL_RANK, policy)
}

// --- The plot box ----------------------------------------------------------------------

/**
 * The measured box, minus chrome.
 *
 * Single pass, fixed order, no re-entry. Clamped at zero in both dimensions: a box smaller
 * than its own chrome yields a plot of `0 × 0`, which the rungs read as *"below every
 * threshold"* and answer with `marks.primary.kind: 'none'`. That is the correct answer and
 * it arrives without a special case.
 *
 * ⚠ Non-finite input collapses to zero rather than throwing, for the reason
 * `resolveSizeClass()` gives: every browser delivers a transient measurement of `0` at
 * least once — `display: none`, print layout, the first frame of a detached element — and
 * a resolver that throws inside a `ResizeObserver` callback takes the widget down with it.
 *
 * @param ctx The measured container.
 * @param spec The chrome the rung has already committed to.
 * @param seriesCount `DataShape.series`; bounds the external legend band.
 * @param policy Resolved policy — never a partial.
 */
export function resolvePlotBox(
  ctx: SizeContext,
  spec: ChromeSpec,
  seriesCount: number,
  policy: PlanPolicy,
): PlotBox {
  const boxWidth = Number.isFinite(ctx.width) && ctx.width > 0 ? ctx.width : 0
  const boxHeight = Number.isFinite(ctx.height) && ctx.height > 0 ? ctx.height : 0

  const legend = legendBands(spec.legend, seriesCount, policy)

  // Horizontal: y gutter → plot width. §1.3, verbatim.
  const width =
    boxWidth - yAxisGutter(spec.y, policy) - yAxisGutter(spec.y2, policy) - legend.width

  // Vertical: value → x-axis → legend → table → plot. Ours; see the module docblock.
  const height =
    boxHeight -
    valueBand(spec.valueDisplay, spec.valueTypeScale, boxHeight, policy) -
    xAxisBand(spec.x, policy) -
    legend.height -
    tableBand(spec, policy)

  return Object.freeze({ width: Math.max(0, width), height: Math.max(0, height) })
}

// --- §1.3's fourth link: x label degradation -------------------------------------------

/**
 * ⚠ **Tier C.** Below this many characters an abbreviation stops carrying meaning —
 * `"Jan"`, `"Mon"`, `"Q1"` are the shortest labels anyone actually writes, and two
 * characters cannot distinguish `"January"` from `"June"`. No published source gives a
 * floor, so this is ours and it is a taste value: move it freely.
 */
const MIN_ABBREVIATED_CHARS = 3

/** The result of §1.3's last link, as the two `LabelsPlan` fields it decides. */
export type LabelDegrade = {
  readonly step: DegradeStep
  readonly maxChars: number | null
}

/** No labels to degrade — the state Micro, Tile and every `mode: 'none'` axis are in. */
const NO_DEGRADE: LabelDegrade = Object.freeze({ step: 'none', maxChars: null })

/**
 * The fourth and last link of §1.3: *"y gutter → plot width → x tick count → **x label
 * degrade**"*.
 *
 * The published order is `abbreviate → split → rotate → axis-transpose`
 * (`research/10-responsive-ladder.md` §5.2), and the steps are **cumulative** — reaching
 * `'rotate'` means abbreviation and splitting were tried and did not suffice. So this
 * returns the terminal step, which is what makes the field a state rather than a log of
 * actions (§1.2).
 *
 * ⚠ Rotation is deliberately late. Talbot 2010 penalises it heavily — *"a last resort"* —
 * and it is here only above transposition, which reorients the entire chart.
 *
 * ⚠ **The label is measured as `M`-repeat, not as real text.** `DataShape` carries
 * `labelMaxChars` and no strings, so the widest plausible label of that length is the only
 * thing available; `M` is the widest common Latin glyph. That over-estimates, which is the
 * direction `research/41-text-metrics.md` §6.1 mandates — degrading a shade early is
 * visible and filable, colliding is not. The over-estimate is now bounded rather than
 * open-ended: a real advance table plus `safetyFactor` puts a ceiling on it, where the
 * provisional ~1 em band did not.
 *
 * ⚠ It is still an over-estimate of a *different* kind, and that one does not go away.
 * `M`-repeat is the widest string of its length, and real axis labels — `"Jan 1"`, `"2024"`
 * — are mostly digits and narrow lowercase. So `maxChars` here is a floor on what fits,
 * not a prediction of it. Fixing that needs the strings themselves, which `DataShape`
 * deliberately does not carry (§2): a resolver that takes label text takes the data, and
 * the whole plan-as-data split depends on it not doing so. Recorded in §11.
 *
 * ⚠ Called *after* `resolvePlotBox()` and it does not feed back into it. Degradation
 * changes a label's width and, at `'rotate'`, its height — but `xAxisBand()` charges a full
 * line height for tick labels whatever they say, so no step here can move the band that
 * produced the width it was given. Single pass; no re-entry.
 *
 * @param ticks The x axis's already-decided tick plan. `'none'` short-circuits.
 * @param plotWidth From `resolvePlotBox()`. The plot, not the box.
 * @param labelMaxChars `DataShape.labelMaxChars`.
 */
export function degradeXLabels(
  ticks: TickPlan,
  plotWidth: number,
  labelMaxChars: number,
  policy: PlanPolicy,
): LabelDegrade {
  if (ticks.mode === 'none') return NO_DEGRADE

  const slots = ticks.mode === 'endpoints' ? 2 : ticks.count
  if (!Number.isFinite(slots) || slots <= 0) return NO_DEGRADE
  if (!Number.isFinite(plotWidth) || plotWidth <= 0) return NO_DEGRADE

  // `labelMinSpacing` is in em, not px (Talbot 2010) — hence the multiply by the rank's
  // font size rather than a bare subtraction.
  const budget =
    plotWidth / slots - policy.labelMinSpacing * RANK_FONT_SIZE[TICK_LABEL_RANK]

  const chars = Number.isFinite(labelMaxChars) ? Math.floor(labelMaxChars) : 0
  if (chars <= 0) return NO_DEGRADE

  // A slot too narrow for even a rotated label: nothing horizontal can work.
  if (budget <= 0) return Object.freeze({ step: 'axis-transpose', maxChars: null })

  const width = (n: number): number =>
    measureText('M'.repeat(n), TICK_LABEL_RANK, policy.typography.metrics)

  if (width(chars) <= budget) return NO_DEGRADE

  // 1. abbreviate — the longest truncation that still fits and still means something.
  for (let n = chars - 1; n >= MIN_ABBREVIATED_CHARS; n -= 1) {
    if (width(n) <= budget) return Object.freeze({ step: 'abbreviate', maxChars: n })
  }

  // 2. split — two lines, so the widest line is about half the label.
  //    ⚠ Assumes a break opportunity exists. `DataShape` cannot say whether a label
  //    contains a space, and inventing a `splittable` flag would be a field the resolver
  //    has no way to populate honestly. A label with no break opportunity renders on one
  //    line and the renderer falls through to the next step — recorded in §11.
  if (width(Math.ceil(chars / 2)) <= budget) {
    return Object.freeze({ step: 'split', maxChars: null })
  }

  // 3. rotate — a rotated label costs its LINE HEIGHT in width, not its text length. Same
  //    trap as the y axis title in `yAxisGutter()`, and it reads as correct both ways round.
  if (lineHeight(TICK_LABEL_RANK, policy) <= budget) {
    return Object.freeze({ step: 'rotate', maxChars: null })
  }

  // 4. transpose — reorient the chart so the labels run down the y axis, where the budget
  //    is a line height rather than a slot width. **Tier B**; the first three steps are
  //    A-lit and this one is ours.
  return Object.freeze({ step: 'axis-transpose', maxChars: null })
}
