/**
 * The frame — a `ChartPlan` plus real data plus a pixel box, resolved into coordinates.
 *
 * A plan says *what* to draw and, by `research/40-chart-plan.md` §1.3 containment, is
 * forbidden from saying *where*: no field may be named `width`, `height` or `margin`, and
 * `PlotBox` is *"not a `ChartPlan` field and never will be"* (`./layout.ts`). So a plan alone
 * cannot be rendered. This module supplies the missing half, and it is the only module in
 * `@shiftcharts/core` that sees actual values.
 *
 * ## Two invariants this file exists to hold
 *
 * ⚠ **1. The plot rectangle must be the resolver's plot box, not a second opinion.** Each
 * rung computed a `resolvePlotBox()` internally to choose its mark kind and tick count, then
 * discarded it (§1.3 — the plan carries the consequences, never the dimensions). If this
 * module re-derived that box by its own arithmetic, the chart would be laid out against a
 * plot the resolver never reasoned about, and the disagreement would be invisible: both
 * numbers look plausible, and nothing renders wrong enough to notice. `apps/playground`
 * already names this hazard for a smaller case — *"two components each resolving their own
 * plan would put two disagreeing plot heights on one page."*
 *
 * So `resolveFrame()` **calls `resolvePlotBox()`** for the size, and composes the same
 * exported band functions for the origin. `frame.test.ts` asserts the equality directly
 * across the widths gate G10 already sweeps.
 *
 * ⚠ **2. A `ChartFrame` is plain and serialisable, exactly like a `ChartPlan`.** No scale
 * functions, no closures, no class instances — only numbers, strings and arrays. That is what
 * lets the whole render path stay on the server under decision 7: a frame computed in a
 * server component crosses to a client component as a prop, which a `scaleLinear` could not.
 * A consumer that needs to invert a pixel back to a datum searches `points` — the positions
 * are all here — rather than being handed a scale.
 *
 * ## The gutter this module deliberately does not improve
 *
 * ⚠ `./layout.ts` computes the y-axis gutter from a constant sample string, `'-1,234.5M'`,
 * and its docblock invites this milestone to do better: *"A4 can do better — the renderer
 * knows the formatted domain and can measure it."* **That invitation cannot be taken, and it
 * is worth saying why rather than leaving a reader to wonder if it was forgotten.**
 *
 * Measuring the real y labels here would make this module's gutter differ from the one the
 * resolver used, which breaks invariant 1 above — the more important of the two. Measuring
 * them in `./layout.ts` instead would require the resolver to see values, which is the wall
 * the whole plan-as-data split stands on. The only construction that satisfies both is a new
 * `yLabelMaxChars` count on `DataShape`, derived by `describeShape()` the same way
 * `labelMaxChars` already is — and that changes a public type and moves every one of the six
 * hand-authored rung snapshots gate **G9** compares against `research/40-chart-plan.md` §6.
 * That is a B-milestone change with a research-corpus edit attached, not an A4 refinement.
 *
 * Until then the sample over-estimates, which is the recoverable direction (`./text.ts`
 * §6.1), and both sides over-estimate identically, which is what keeps them in agreement.
 */

import type { SizeContext } from './context.ts'
import type { DataPoint, MetricStatus, Series } from './data.ts'
import { formatHeatmapXLabel, formatXLabel, formatYLabel } from './format.ts'
import {
  legendBands,
  resolvePlotBox,
  resolvePlotInsets,
  resolvedValueBand,
  yAxisGutter,
  type ChromeSpec,
} from './layout.ts'
import type { ChartPlan, NarrativePlan, TickPlan } from './plan.ts'
import type { PlanPolicy } from './policy.ts'
import { resolvePolicy } from './policy.ts'
import { measureText } from './text.ts'
import type { TypeRank } from './text-types.ts'

import { extent } from 'd3-array'
import { scaleLinear, scaleUtc, type ScaleLinear, type ScaleTime } from 'd3-scale'
import { arc as d3Arc, area as d3Area, line as d3Line } from 'd3-shape'

/**
 * ⚠ **Spelled out rather than written `ReturnType<typeof scaleLinear>`, which silently gives
 * the wrong thing.** `scaleLinear` is generic in its range, output and unknown types, and
 * `ReturnType` on a generic function resolves every parameter to its constraint — producing
 * `ScaleLinear<unknown, unknown>`, whose call signature returns `unknown`. Every coordinate
 * derived from it then fails to typecheck, which is the good outcome; the bad one is the same
 * mistake made somewhere a cast papers over it.
 */
type LinearScale = ScaleLinear<number, number>

/**
 * A scale reduced to the two operations this module needs, both in plain numbers.
 *
 * Time is epoch milliseconds throughout. See `wrapUtc()` at the bottom for why.
 */
type AxisScale = {
  readonly at: (value: number) => number
  readonly ticks: (count: number) => number[]
}

/**
 * ⚠ **`.digits(2)` on every generator in this file, and it is a decision rather than a
 * default.** d3-shape rounds path coordinates to 3 decimals out of the box, which is already
 * what makes exact `d`-string assertions possible at all — an unrounded generator emits
 * float noise that differs by platform. Tightening to 2 costs nothing visible at any
 * plausible device pixel ratio and buys a shorter, stabler string.
 *
 * Measured: `.digits(2)` gives `M0,0L1.23,2.35L3,4` where the default gives
 * `M0,0L1.235,2.346L3,4`.
 *
 * Do not remove this to "let d3 decide". Path determinism is what gate **G14**'s element
 * snapshots and the `d`-string equality test both rest on.
 */
const PATH_DIGITS = 2

// --- The frame -------------------------------------------------------------------------

/** A rectangle in the SVG's own coordinate space. Origin top-left, as SVG counts. */
export type Rect = {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/**
 * One axis tick, resolved.
 *
 * `offset` is px along the axis from the plot's origin — not an absolute SVG coordinate — so
 * that `<Axis>` can be translated as a unit and the ticks travel with it.
 */
export type ComputedTick = {
  /** The domain value, kept for callers that need it. Serialisable: a `Date` becomes an ISO
   * string through `JSON.stringify` and is not read back by anything here. */
  readonly value: number | string
  readonly offset: number
  readonly label: string
}

/** A point's position in the plot's coordinate space, with the datum that produced it. */
export type PointPos = {
  readonly x: number
  readonly y: number
  readonly value: number
}

/** One donut slice in absolute SVG geometry, with its stable data identity preserved. */
export type ArcFrame = {
  readonly id: string
  readonly label: string
  readonly value: number
  readonly share: number
  readonly startAngle: number
  readonly endAngle: number
  readonly cx: number
  readonly cy: number
  readonly innerRadius: number
  readonly outerRadius: number
  /** A local path around (0, 0); the renderer translates it to `cx, cy`. */
  readonly d: string
  readonly other: boolean
}

/** Target-aware progress geometry and semantics, kept separate from donut slices and bars. */
export type ProgressFrame = {
  readonly orientation: 'horizontal' | 'radial'
  readonly current: number | null
  readonly target: number | null
  readonly ratio: number | null
  readonly remaining: number | null
  readonly overTarget: number | null
  readonly indeterminate: boolean
  /** Horizontal track/fill rectangles; null for radial progress. */
  readonly track: Rect | null
  readonly fill: Rect | null
  /** Radial local paths and their absolute centre; null for horizontal progress. */
  readonly trackPath: string | null
  readonly fillPath: string | null
  readonly cx: number | null
  readonly cy: number | null
  readonly innerRadius: number | null
  readonly outerRadius: number | null
}

/** One ordered funnel stage, with the value semantics needed by every larger rung. */
export type FunnelStageFrame = {
  readonly id: string
  readonly label: string
  readonly index: number
  readonly value: number
  readonly share: number
  readonly conversion: number | null
  readonly dropoff: number | null
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  /**
   * The room available for this stage's *label*, not its bar. `width` scales with `share`, but
   * every stage's label sits at the same horizontal position regardless of its own bar's width
   * — centered on the plot for a vertical funnel (every bar is itself centered there, so a
   * narrow-share bar's label center is exactly the same x as a full-width bar's), and started
   * at the plot's left edge for a horizontal one (every bar starts there too). So the true
   * budget is the plot width in both orientations, not the individual stage's `width` — using
   * `width` would degrade a low-share stage's label for room it never actually lacked.
   */
  readonly labelWidth: number
}

/** Funnel geometry and non-colour stage semantics resolved from the source series. */
export type FunnelFrame = {
  readonly stages: readonly FunnelStageFrame[]
  readonly overallConversion: number | null
}

/**
 * One horizon band. `sign` is `1` for bands above the baseline and `-1` for the mirrored
 * negative bands; `band` is the 0-based index outward from the baseline, which is what drives
 * the increasing opacity a horizon chart reads by.
 */
export type HorizonBand = {
  readonly sign: 1 | -1
  readonly band: number
  readonly d: string
}

export type SeriesFrame = {
  readonly id: string
  /** Falls back to `id` when the series carries no label, so the renderer never branches. */
  readonly label: string
  /** 0-based, and the index into the `--shiftcharts-series-N` colour ramp. */
  readonly index: number
  /** Optional KPI metadata copied into the serialisable frame. */
  readonly unit: string | null
  readonly target: number | null
  readonly status: MetricStatus | null
  /** `null` when the mark kind is not `'line'`, or when nothing is defined. */
  readonly line: string | null
  /** `null` unless the plan asked for an area. */
  readonly area: string | null
  /** Empty unless the mark kind is `'horizon'`. */
  readonly bands: readonly HorizonBand[]
  /** Empty unless the mark kind is `'bar'` or `'cell'`. */
  readonly cells: readonly CellFrame[]
  /** Empty unless the mark kind is `'arc'`. */
  readonly arcs: readonly ArcFrame[]
  /** Non-null only for the target-aware progress mark. */
  readonly progress: ProgressFrame | null
  /** Non-null only for the ordered funnel mark. */
  readonly funnel: FunnelFrame | null
  /**
   * ⚠ **Every** defined point, always — not only the ones `marks.points.mode` renders.
   * Geometry belongs to the frame and the decision to draw belongs to the plan, so
   * `<PointMarks>` filters this rather than the frame pre-filtering it. It is also what a
   * crosshair does nearest-neighbour search over at A5, where `mode` is `'none'`.
   */
  readonly points: readonly PointPos[]
  /** Indices into `points`. `null` when the series has no defined values. */
  readonly extrema: { readonly min: number; readonly max: number; readonly last: number } | null
}

/**
 * Everything `<Chart>` needs that a plan cannot carry.
 *
 * Plain and serialisable throughout — see invariant 2 in the module docblock.
 */
export type ChartFrame = {
  /** The measured element, at the origin. `<svg>`'s `viewBox` is this. */
  readonly box: Rect
  /** Where marks go. Its `width`/`height` are `resolvePlotBox()`'s, exactly. */
  readonly plot: Rect
  /**
   * The exact band charged for a reserved or external legend, or `null` when the plan does
   * not charge legend space. This is geometry rather than presentation: renderers may expose
   * it as CSS layout properties, but must not invent a competing rail.
   */
  readonly legend: Rect | null
  readonly xTicks: readonly ComputedTick[]
  readonly yTicks: readonly ComputedTick[]
  readonly series: readonly SeriesFrame[]
  /** The y value pixel-mapped, for a zero rule or threshold band. `null` if 0 is outside the
   * domain, which is a state rather than a coordinate off-screen. */
  readonly zeroLine: number | null
  /**
   * The value display — the big number above the plot — or `null` when
   * `narrative.valueDisplay` is `'none'`. Null **exactly** then: a band with no series to
   * report is still a band the resolver subtracted from the plot, so it is reported as a
   * region with no entries rather than as an absence.
   *
   * ⚠ **Only `value` and `plot` are SVG-positioned regions, so there is no
   * `Record<RegionName, Rect>` here and there should not be one.** `regionOrder` names four
   * things and they do not live in one coordinate space: the data table is a `<figcaption>`
   * *outside* the `<svg>`, laid out by the document, and a `'direct'` legend has no rectangle
   * at all — `Labels.tsx` puts each label at its own series' line end, so its geometry is
   * per-series and already in `SeriesFrame.points`. A map keyed by region name would have to
   * invent a rectangle for both, and an invented rectangle that nothing draws into is the
   * failure this field exists to remove.
   *
   * ⚠ **The shape is spelled inline, and `ValueFrame`/`ValueEntry` below are derived from
   * it.** Gate G6 walks the type surface of every barrel export: a named `ValueFrame`
   * referenced from here that `../index.ts` does not re-export is a hard failure, and that
   * barrel is not in this change's scope. Deriving the aliases keeps one definition, so
   * flipping the two round once the barrel carries them changes nothing but the arrows.
   */
  readonly value: {
    /** The band, in absolute SVG coordinates. Composed exactly as `plot`'s origin is. */
    readonly region: Rect
    /**
     * The semantic composition the renderer should expose in this band.
     *
     * `entries[].label` has always travelled with the value so consumers could recover the
     * series identity, but the old contract treated that label as table-only metadata. That
     * made a multi-series Micro/Tile frame look like a row of unowned numbers when the static
     * renderer painted it. The intent is explicit now: paint the series label with the value,
     * and expose the delta as supporting context only when the plan asks for it. Strip has no
     * value frame at all, so it remains shape-only rather than gaining a hidden metric band.
     *
     * This is a render instruction, not presentation CSS. It is plain data and is derived from
     * the plan's existing `valueDisplay`, so server and client render the same composition.
     */
    readonly presentation: {
      readonly label: 'series'
      readonly context: 'none' | 'delta'
    }
    /** Explicit coverage for compact multi-series readouts; the plot may still show every series. */
    readonly coverage?: {
      readonly totalSeries: number
      readonly valueSeries: number
      readonly shownSeries: number
      readonly hiddenSeries: number
    }
    /** px, already fitted to the band. `0` when nothing is drawn — see `fitValueDisplay()`. */
    readonly fontSize: number
    readonly entries: readonly {
      readonly seriesId: string
      /**
       * ⚠ **The series' own index, not this entry's position.** They differ the moment a
       * series has no defined point and contributes no entry, and the difference is what
       * binds a painted number to the right colour in the six-colour ramp. Re-deriving it
       * from the array position would tint the third series with the second's colour and
       * look entirely correct.
       */
      readonly seriesIndex: number
      /** The series' human label, painted according to `value.presentation.label`. */
      readonly label: string
      /** The formatted latest value. */
      readonly text: string
      /** Optional KPI unit, rendered as visible text rather than inferred from formatting. */
      readonly unit: string | null
      /** Optional KPI target, rendered with its label when finite and present. */
      readonly target: { readonly value: number; readonly text: string } | null
      /** Optional KPI state, rendered as text and available to a theme as metadata. */
      readonly status: MetricStatus | null
      /** `'latest+delta'` only, and only when a previous defined point exists. */
      readonly delta: {
        readonly text: string
        readonly direction: 'up' | 'down' | 'flat'
      } | null
      /** Previous-value text when the plan requests a comparison basis. */
      readonly comparison: string | null
      /** Progress qualifiers derived from the latest value and explicit target. */
      readonly progress?: {
        readonly current: number | null
        readonly target: number | null
        readonly remaining: number | null
        readonly overTarget: number | null
        readonly remainingText: string | null
        readonly overTargetText: string | null
        readonly indeterminate: boolean
      } | null
      /** Centre of this entry's column, absolute SVG coordinates. */
      readonly x: number
      /** Vertical centre of the band, absolute SVG coordinates. */
      readonly y: number
    }[]
    /**
     * The entries that did not fit, made visible. `null` when every entry is shown.
     * See `fitValueDisplay()` for why a cap exists and why it is not silent.
     */
    readonly overflow: {
      readonly hidden: number
      readonly text: string
      readonly x: number
      readonly y: number
    } | null
  } | null
}

export type CellFrame = {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  /** Heatmap identity; bar cells omit these family-specific qualifiers. */
  readonly id?: string | undefined
  /** Heatmap intensity source; null spells an explicit missing cell. */
  readonly value?: number | null | undefined
  /** Normalised 0–1 intensity for heatmap presentation; null for missing cells. */
  readonly intensity?: number | null | undefined
  readonly column?: number | undefined
  readonly row?: number | undefined
}

/**
 * The value display region, nameable.
 *
 * ⚠ Derived rather than declared — see the ⚠ on `ChartFrame.value`. `NonNullable` and the
 * indexed access are both things a consumer can write, so this is a real name for the shape
 * and not a private alias for one.
 */
export type ValueFrame = NonNullable<ChartFrame['value']>

/**
 * One value in the display.
 *
 * `label` is the pairing between a painted value and its series. `ChartFrame.value.presentation`
 * makes the renderer's use of that pairing explicit; colour remains a redundant visual cue,
 * not the only identity channel. The data table still carries the same label for the accessible
 * full-detail path.
 */
export type ValueEntry = ValueFrame['entries'][number]

/** A change since the previous defined point. `direction` is redundant with the sign, on purpose. */
export type ValueDelta = NonNullable<ValueEntry['delta']>

// --- Chrome reconstruction ---------------------------------------------------------------

/**
 * The `ChromeSpec` the rung committed to, read back off the finished plan.
 *
 * ⚠ This is a reconstruction, and it is faithful because every field of `ChromeSpec` is a
 * field the plan also carries — `layout.ts` chose those eight deliberately for that reason.
 * With no overrides applied it reproduces the rung's own spec exactly, which is what makes
 * the plot-box equality assertion hold.
 *
 * ⚠ **With overrides applied it may differ, and that is correct rather than a leak.** An
 * override that forces `axes.y.visible: false` should give the plot the gutter back; the
 * resolver's internal box predates the override by construction (§5 — policy before
 * resolution, overrides after). So the frame follows the final plan, and a forced axis
 * changes the geometry the way a reader would expect it to.
 *
 * Exported from this module but deliberately **not** from `../index.ts`: it exists so that
 * `frame.test.ts` can assert the plot-box equality against the real mapping instead of
 * against a second copy of it, which would test nothing.
 */
export function chromeFromPlan(plan: ChartPlan, plotInset = 0): ChromeSpec {
  return {
    x: plan.axes.x,
    y: plan.axes.y,
    y2: plan.axes.y2,
    legend: plan.legend,
    valueDisplay: plan.narrative.valueDisplay,
    valueTypeScale: plan.narrative.valueTypeScale,
    tableDisclosure: plan.dataTable.disclosure,
    tablePresent: plan.dataTable.present,
    plotPresence: plan.marks.primary.kind === 'none' ? 'none' : 'present',
    plotInset,
  }
}

// --- Domains -----------------------------------------------------------------------------

/**
 * A degenerate domain padded to a real one.
 *
 * ⚠ A single data point, or a flat series, gives `[v, v]`. d3 maps every value in such a
 * domain to the range's *start* — so a flat line renders along the top edge rather than
 * through the middle, and a one-point series renders at the left edge. Both look like layout
 * bugs and neither is; the scale is doing exactly what it was asked. Padding by a unit either
 * side is the conventional repair and it puts the mark where a reader expects it.
 */
function padDegenerate(lo: number, hi: number): readonly [number, number] {
  if (lo !== hi) return [lo, hi]
  // A flat series at zero needs a symmetric unit; one at 500 needs something proportional,
  // or the padding is invisible.
  const pad = lo === 0 ? 1 : Math.abs(lo) * 0.05
  return [lo - pad, hi + pad]
}

function xDomain(
  data: readonly Series[],
  temporalBin: ChartPlan['aggregate']['temporalBin'] = 'none',
): readonly [number, number] {
  const values: number[] = []
  for (const s of data) {
    for (const p of s.points) {
      const v = heatmapXValue(p.x, temporalBin)
      if (Number.isFinite(v)) values.push(v)
    }
  }
  const [lo, hi] = extent(values)
  // No usable x anywhere. A unit domain keeps every downstream scale finite; nothing will be
  // drawn on it, because there are no points to draw.
  if (lo === undefined || hi === undefined) return [0, 1]
  return padDegenerate(lo, hi)
}

/**
 * Return the distinct category positions used by a mark, in source-independent order.
 *
 * Bars need the same category centres as the x axis, but their visual width extends on both
 * sides of each centre. Keeping the category extraction in one helper makes the endpoint
 * treatment below explicit instead of letting grouped bars inherit the x scale's edge contact.
 */
function categoryValues(
  data: readonly Series[],
  temporalBin: ChartPlan['aggregate']['temporalBin'] = 'none',
): readonly number[] {
  const values = [
    ...new Set(
      data.flatMap((s) =>
        s.points.map((point) => heatmapXValue(point.x, temporalBin)),
      ),
    ),
  ]
  return values.filter((value): value is number => Number.isFinite(value)).sort((a, b) => a - b)
}

/**
 * Inset the first and last bar categories by half a category gap.
 *
 * A point scale maps the first and last categories to the plot edges. That is appropriate for
 * lines, but a bar is a finite rectangle centred on the category, so the edge categories then
 * need a clamp and the two outer gaps become visibly unequal. Padding the domain preserves the
 * resolved plot box while making those outer gaps equal. One-category domains stay on the
 * existing degenerate-domain contract because there is no measured gap to infer.
 */
function paddedBarDomain(
  domain: readonly [number, number],
  categories: readonly number[],
): readonly [number, number] {
  if (categories.length < 2) return domain
  let smallestGap = Number.POSITIVE_INFINITY
  for (let index = 1; index < categories.length; index += 1) {
    const previous = categories[index - 1]
    const current = categories[index]
    if (previous === undefined || current === undefined || current <= previous) continue
    smallestGap = Math.min(smallestGap, current - previous)
  }
  if (!Number.isFinite(smallestGap) || smallestGap <= 0) return domain
  const padding = smallestGap / 2
  return [domain[0] - padding, domain[1] + padding]
}

/**
 * ⚠ **Zero is not forced into the y domain, and that is the right default for a line.**
 * Forcing zero is a *bar* convention — a bar encodes value by length, so a truncated baseline
 * lies about ratios. A line encodes value by position, and forcing zero on a series that
 * varies between 990 and 1010 flattens it into a horizontal rule that shows nothing. Cleveland
 * and every charting library that has thought about it split the same way.
 *
 * `hasNegative` therefore does not change the domain here. It reaches the plan, where it
 * belongs, and `zeroLine` below gives the renderer the baseline to draw when zero is in view.
 */
function yDomain(
  data: readonly Series[],
  mark: ChartPlan['marks']['primary'],
): readonly [number, number] {
  const values: number[] = []
  for (const s of data) {
    for (const p of s.points) {
      if (p.y !== null && Number.isFinite(p.y)) values.push(p.y)
    }
  }
  const [lo, hi] = extent(values)
  if (lo === undefined || hi === undefined) return [0, 1]
  // A bar's length is read from zero. Include the baseline before the scale is built so a
  // positive-only or negative-only series cannot produce a truncated bar that exaggerates its
  // magnitude. Line/area keep the data-only domain described above.
  return mark.kind === 'bar' || mark.kind === 'cell' || mark.kind === 'funnel'
    ? [Math.min(0, lo), Math.max(0, hi)]
    : padDegenerate(lo, hi)
}

// --- Ticks -------------------------------------------------------------------------------

/**
 * ⚠ **`'endpoints'` reads the data, `'count'` reads the scale, and collapsing them would be
 * a silent semantic upgrade.** `./plan.ts` is emphatic: two ticks chosen by Talbot's
 * algorithm land on *nice* values, endpoints land on the *first and last data points*, and
 * *"collapsing them would silently upgrade Strip to a value-legible chart."* Strip explicitly
 * does not claim value legibility (gate **G12**), so it labels the extent of the data rather
 * than a readable scale. That is the whole difference, and it is one `if`.
 *
 * ⚠ **A `'count'` tick label may be narrower than `describeShape()` predicted, and only in
 * that direction.** `labelMaxChars` measures the widest *data* label; nice tick values are
 * round ones — `2024`, `Jan`, `500` — and round is short. So the resolver degrades against an
 * over-estimate, which fires a rung early at worst. Erring wide is the recoverable direction
 * (`./text.ts` §6.1); the reverse would collide labels with no test able to see it.
 */
function computeTicks(
  plan: TickPlan,
  scale: AxisScale,
  dataValues: readonly number[],
  label: (value: number) => string,
  temporal: boolean,
  origin: number,
  tickExtra: boolean = false,
): readonly ComputedTick[] {
  if (plan.mode === 'none') return []

  const toTick = (v: number): ComputedTick =>
    Object.freeze({
      value: temporal ? new Date(v).toISOString() : v,
      offset: scale.at(v) - origin,
      label: label(v),
    })

  if (plan.mode === 'endpoints') {
    const first = dataValues[0]
    const last = dataValues[dataValues.length - 1]
    if (first === undefined || last === undefined) return []
    return Object.freeze(first === last ? [toTick(first)] : [toTick(first), toTick(last)])
  }

  const count = Number.isFinite(plan.count) ? Math.max(0, Math.floor(plan.count)) : 0
  if (count === 0) return []

  // ⚠ **`scale.ticks()` can return the same value twice, and it is not a d3 bug.** Swept
  // 2026-08-24 over seven magnitudes (`1e3`…`1e15`, a hundredfold apart), ten spans
  // (`1e-9`…`1e7`) and counts 2–12: **60 of those 770 combinations return duplicates**, all
  // in one regime — a span tiny relative to the magnitude, where float64 has no room left
  // between steps. `[1e9, 1e9 + 1e-6]` at 50 ticks returns 49 ticks carrying 7 distinct
  // values, with a run of nine consecutive `1000000000`s among them.
  // `padDegenerate()` does not catch it, because it only fires when `lo === hi` exactly and
  // here they genuinely differ.
  //
  // Two ticks with one value are the same tick: same `label(v)`, same `scale.at(v)`, so the
  // same glyph and the same `<rect>` drawn twice at the same pixel. Dropping the repeat is
  // correct on its own — it is invisible output either way — and it is what makes `value`
  // safe as a React key, which A6 needs: `<Grid>` and `<Axis>` key by it so a gridline that
  // survives a densify keeps its identity and slides instead of being replaced. A duplicate
  // key would put React's reconciler in exactly the state the keys exist to avoid.
  // See `research/decisions/016-what-svg-geometry-actually-transitions.md`.
  const seen = new Set<number | string>()
  const ticks: Array<{ readonly rawValue: number; readonly tick: ComputedTick }> = []
  for (const rawValue of scale.ticks(count)) {
    const tick = toTick(rawValue)
    if (seen.has(tick.value)) continue
    seen.add(tick.value)
    ticks.push({ rawValue, tick })
  }

  // Support tickExtra: Vega-Lite concept to add an extra tick past the strict domain
  if (tickExtra && count > 0 && ticks.length > 0) {
    // Keep the raw numeric domain values alongside the serialised public values. Temporal
    // tick values are ISO strings by contract, so using `ComputedTick.value` here would turn
    // the next value into `NaN` rather than another epoch millisecond.
    const first = ticks[0]!
    const second = ticks[1]
    const valueStep = second === undefined ? 0 : second.rawValue - first.rawValue
    if (valueStep !== 0 && Number.isFinite(valueStep)) {
      const last = ticks[ticks.length - 1]!
      const extraRawValue = last.rawValue + valueStep
      const extraTick = toTick(extraRawValue)
      if (!seen.has(extraTick.value)) {
        ticks.push({ rawValue: extraRawValue, tick: extraTick })
      }
    }
  }

  return Object.freeze(ticks.map(({ tick }) => tick))
}

// --- The value display -------------------------------------------------------------------

/**
 * ⚠ **Rank A, and the choice is the advance table rather than the size.** `./layout.ts`
 * fits the value display by *budget*, not by rank — `valueTypeScale: 'fit'` means "as large
 * as the band allows" — so no rank supplies the font size here. What a rank supplies is a
 * measured advance table, and `FontMetrics.byRank` is measured per variable-font instance:
 * rank A is the 700-weight instance, which is the weight `--shiftcharts-value-label-font-weight`
 * paints at. Measuring a bold number against the 400-weight table under-estimates its
 * width, and under-estimating width is the direction `./text.ts` §6.1 forbids.
 */
const VALUE_RANK: TypeRank = 'A'

/**
 * ⚠ **The legibility floor, taken from core rather than from a token.** 10 px agrees
 * numerically with `--shiftcharts-label-font-size-min`. It is read from the policy's E rank rather
 * than a module constant, because this number is folded into a layout decision — how many
 * values are shown — so a custom typography policy must change both the resolver and frame.
 */
/**
 * Width of `text` per 1 px of font size.
 *
 * Letter spacing is deliberately excluded here. The value display can fit to a dynamic
 * font size, so glyph advances are solved as a ratio and CSS letter spacing is added as a
 * fixed px cost at the final candidate size. This keeps custom `PlanPolicy.typography`
 * values synchronized with both the planner and the painter.
 */
function emAdvance(text: string, policy: PlanPolicy): number {
  return measureText(text, VALUE_RANK, policy.typography.metrics, {
    fontSize: 1,
    letterSpacing: 0,
  })
}

/**
 * ⚠ Truncated to 2 dp, never rounded to nearest. This is a *maximum* that fits, and
 * `metrics.safetyFactor`'s note says the same thing from the other side: rounding a bound
 * the wrong way stops it being a bound. Two decimals matches `PATH_DIGITS` and `roundCoord()`
 * so that nothing downstream reintroduces float noise into a snapshot.
 */
function floorTo2(n: number): number {
  return Math.floor(n * 100) / 100
}

/**
 * The change since the previous defined point.
 *
 * `formatYLabel` is reused deliberately — it is the one place a value becomes a string, and
 * a delta formatted by a second rule would disagree with the number directly above it. The
 * `'+'` is added here because `format('~s')` signs only negatives (with U+2212, which the
 * advance table does not carry and therefore over-estimates — the safe direction).
 */
function deltaOf(change: number): ValueDelta {
  if (!Number.isFinite(change) || change === 0) {
    return Object.freeze({ text: formatYLabel(0), direction: 'flat' as const })
  }
  const text = formatYLabel(change)
  return change > 0
    ? Object.freeze({ text: `+${text}`, direction: 'up' as const })
    : Object.freeze({ text, direction: 'down' as const })
}

/** What the overflow marker says. `+2`, in the same column grid as the values. */
function overflowText(hidden: number): string {
  return `+${hidden}`
}

/**
 * Fit the value display into the band `./layout.ts` already subtracted from the plot.
 *
 * ## The font size is `valueBand()` run backwards
 *
 * ⚠ `valueBand()` turns a requested type size into a band:
 * `height = (ascent + descent + lineGap) × fontSize`. This is the same equation solved the
 * other way — `fontSize = height / (ascent + descent + lineGap)` — which is therefore not an
 * approximation of the largest size that fits but *exactly* it. The symmetry is the point:
 * one of the two directions is the layout the plot was sized against, and if the painter
 * fitted by any other rule the number would overflow a band nothing else knows changed.
 *
 * The horizontal fit is the ordinary one: a column's width divided by the string's advance
 * per px. The smaller of the two wins, so text can never leave the band in either axis.
 *
 * ## Three big numbers in a 60 × 24 box
 *
 * ⚠ **The entry count is capped by legibility, and the cap is visible.** Even division is
 * what `narrative.valueDisplay` asks for, but at Micro three columns of a 60 px box are 20 px
 * wide and a fitted value lands near 5 px — present, painted, and unreadable, which is the
 * exact species of failure this whole change exists to remove. So the fit is tried at every
 * count from all-of-them down to one, and the first that reaches the policy's E-rank floor wins.
 *
 * The values that lose are **not** dropped silently: they are replaced by a `+N` marker that
 * takes a column of its own, so the reader is told the count they cannot see, and every one
 * of them stays reachable in the data table, which `./rungs/line.ts` keeps `present: true`
 * at both rungs that ask for a value display. `legendBands()` caps entries for the same
 * reason — *"a legend that grows with the series count could consume the whole box"* — and
 * `chart.css`'s six-colour ramp makes its own overflow visible rather than wrapping, which
 * is the house precedent this follows.
 *
 * ⚠ **The floor cannot force the count below one, and it is not allowed to fight the band.**
 * The effective floor is `min(policy.typography.byRank.E.fontSize, verticalFit)`: when the band itself is
 * shorter than 10 px of type, no entry count helps, because the vertical fit does not depend
 * on the count. Reducing to one entry and rendering it as large as the resolver's own band
 * permits is then the honest outcome — the alternative is the empty band.
 */
function fitValueDisplay(
  narrative: NarrativePlan,
  series: readonly SeriesFrame[],
  region: Rect,
  policy: PlanPolicy,
  mode: 'latest' | 'donut-total' | 'funnel-conversion' = 'latest',
): ChartFrame['value'] {
  const presentation = Object.freeze({
    label: 'series' as const,
    context: narrative.valueDisplay === 'latest+delta' ? ('delta' as const) : ('none' as const),
  })
  const empty = Object.freeze({
    region,
    presentation,
    coverage: Object.freeze({
      totalSeries: series.length,
      valueSeries: 0,
      shownSeries: 0,
      hiddenSeries: 0,
    }),
    fontSize: 0,
    entries: Object.freeze([]),
    overflow: null,
  })

  // "Latest" is the last point whose `y` is non-null, and `SeriesFrame.points` holds only
  // defined points in data order — so it is the last element, and a series with no defined
  // point contributes no entry at all. Not a '—' entry: a placeholder in a value display is a
  // reading of the data, and there is no reading to give.
  const drafts = series.flatMap((s) => {
    if (mode === 'donut-total') {
      // Sum the raw defined points, not `s.arcs` — arcs are only built when `mark.kind==='arc'`
      // (Tile and above), so at Micro (`mark.kind==='none'`) `s.arcs` is always empty and this
      // total must not depend on it. `s.points` holds every defined point regardless of mark
      // kind, and its sum equals the arc-built total exactly (arcs partition these same values
      // into visible/Other without loss), so larger-rung totals are unchanged by this.
      const total = s.points.reduce((sum, p) => sum + p.value, 0)
      return [{
        seriesId: s.id,
        seriesIndex: s.index,
        label: s.label,
        text: formatYLabel(total),
        // A donut's compact reading is the total of its parts, not the last category. Keep the
        // qualifier visible so a number such as `1` cannot masquerade as the whole donut.
        unit: 'total',
        target: null,
        status: null,
        delta: null,
        comparison: null,
        progress: null,
      }]
    }
    if (mode === 'funnel-conversion') {
      const conversion = s.funnel?.overallConversion ?? null
      if (conversion === null) return []
      return [{
        seriesId: s.id,
        seriesIndex: s.index,
        label: 'Overall conversion',
        text: String(Math.round(conversion * 100)) + '%',
        unit: null,
        target: null,
        status: null,
        delta: null,
        comparison: null,
        progress: null,
      }]
    }
    const last = s.points[s.points.length - 1]
    if (last === undefined) return []
    const previous = s.points[s.points.length - 2]
    return [
      {
        seriesId: s.id,
        seriesIndex: s.index,
        label: s.label,
        text: formatYLabel(last.value),
        unit: s.unit,
        target:
          s.target !== null && s.target !== undefined && Number.isFinite(s.target)
            ? Object.freeze({ value: s.target, text: formatYLabel(s.target) })
            : null,
        status: s.status,
        delta:
          narrative.valueDisplay === 'latest+delta' && previous !== undefined
            ? deltaOf(last.value - previous.value)
            : null,
        comparison:
          narrative.deltaBasis && previous !== undefined ? formatYLabel(previous.value) : null,
        progress: s.progress === null
          ? null
          : Object.freeze({
              current: s.progress.current,
              target: s.progress.target,
              remaining: s.progress.remaining,
              overTarget: s.progress.overTarget,
              remainingText:
                s.progress.remaining === null ? null : formatYLabel(s.progress.remaining),
              overTargetText:
                s.progress.overTarget === null ? null : formatYLabel(s.progress.overTarget),
              indeterminate: s.progress.indeterminate,
            }),
      },
    ]
  })
  if (drafts.length === 0) return empty

  // The painted string, which is the string measured. The series label is part of the value
  // composition, not a table-only annotation. The gap between a label, value and delta is a
  // space *inside* the text rather than a `dx` on a tspan, so that the width fitted is the width
  // drawn; a gap added after measurement is a gap the fit does not know about.
  const painted = (d: (typeof drafts)[number]): string => {
    const parts = presentation.label === 'series' && d.label.length > 0 ? [d.label, d.text] : [d.text]
    if (d.unit !== null && d.unit !== undefined && d.unit.length > 0) parts.push(d.unit)
    if (d.delta !== null) parts.push(d.delta.text)
    if (d.comparison !== null) parts.push(`(${d.comparison})`)
    if (d.target !== null) parts.push(`target ${d.target.text}`)
    if (d.status !== null) parts.push(`status ${d.status}`)
    if (d.progress !== null && d.progress !== undefined) {
      if (d.progress.indeterminate) parts.push('indeterminate')
      else if (d.progress.overTarget !== null && d.progress.overTarget > 0) {
        parts.push(`over target ${formatYLabel(d.progress.overTarget)}`)
      } else if (d.progress.remaining !== null) {
        parts.push(`remaining ${formatYLabel(d.progress.remaining)}`)
      }
    }
    return parts.join(' ')
  }

  const v = policy.typography.metrics.vertical
  const emHeight = v.ascent + v.descent + v.lineGap
  const verticalFit = emHeight > 0 ? region.height / emHeight : 0
  const floor = Math.min(policy.typography.byRank.E.fontSize, verticalFit)
  const valueStyle = policy.typography.byRank[VALUE_RANK]
  const widthAtOnePx = (text: string): number => emAdvance(text, policy)
  const maxFontSizeFor = (text: string, budget: number): number => {
    const spacing = valueStyle.letterSpacing * Math.max(0, Array.from(text).length - 1)
    const glyphBudget = budget - spacing
    const advance = widthAtOnePx(text)
    return glyphBudget <= 0 || advance <= 0 ? 0 : glyphBudget / advance
  }

  let shown = drafts.length
  let fontSize = 0
  for (let count = drafts.length; count >= 1; count -= 1) {
    const hidden = drafts.length - count
    // The overflow marker is a column, not an annotation squeezed into one.
    const columns = hidden > 0 ? count + 1 : count
    const budget = region.width / columns - policy.regionGap
    let fitting = verticalFit
    if (hidden > 0) fitting = Math.min(fitting, maxFontSizeFor(overflowText(hidden), budget))
    for (let i = 0; i < count; i += 1) {
      const draft = drafts[i]
      if (draft !== undefined) fitting = Math.min(fitting, maxFontSizeFor(painted(draft), budget))
    }
    shown = count
    fontSize = floorTo2(fitting)
    if (fontSize >= floor) break
  }

  // A band with no area, or a box too narrow for one glyph. `<text font-size="0">` is an
  // element that paints nothing while claiming to paint something.
  if (!Number.isFinite(fontSize) || fontSize <= 0) return empty

  const hidden = drafts.length - shown
  const columns = hidden > 0 ? shown + 1 : shown
  const columnWidth = region.width / columns
  const y = region.y + region.height / 2
  const centre = (index: number): number => region.x + (index + 0.5) * columnWidth

  return Object.freeze({
    region,
    presentation,
    coverage: Object.freeze({
      totalSeries: series.length,
      valueSeries: drafts.length,
      shownSeries: shown,
      hiddenSeries: hidden,
    }),
    fontSize,
    entries: Object.freeze(
      drafts.slice(0, shown).map((d, i) => Object.freeze({ ...d, x: centre(i), y })),
    ),
    overflow:
      hidden > 0
        ? Object.freeze({ hidden, text: overflowText(hidden), x: centre(shown), y })
        : null,
  })
}

// --- The resolver ------------------------------------------------------------------------

/**
 * Materialise the same legend cost that `resolvePlotBox()` already subtracts. Keeping this in
 * core makes the HTML/SVG rail agree with the serialisable plot geometry at every placement.
 */
function resolveLegendRegion(
  plan: ChartPlan['legend'],
  band: { readonly width: number; readonly height: number },
  box: Rect,
  plot: Rect,
): Rect | null {
  if (band.width === 0 && band.height === 0) return null

  if (plan.placement === 'internal') {
    if (plan.flow !== 'reserved') return null
    return Object.freeze({ x: plot.x, y: plot.y - band.height, width: plot.width, height: band.height })
  }
  if (plan.placement !== 'external') return null

  if (plan.position === 'left') return Object.freeze({ x: 0, y: 0, width: band.width, height: box.height })
  if (plan.position === 'right') return Object.freeze({ x: box.width - band.width, y: 0, width: band.width, height: box.height })
  if (plan.position === 'top') return Object.freeze({ x: 0, y: 0, width: box.width, height: band.height })
  return Object.freeze({ x: 0, y: box.height - band.height, width: box.width, height: band.height })
}

/**
 * `(plan, data, ctx)` → the coordinates that draw it.
 *
 * Pure: no measurement, no clock, no state, no randomness. Same inputs, same frame, on a
 * server and in a browser — which is what decision 7's zero-JavaScript path is built on.
 *
 * @param plan From `planChart()`. Its decisions are obeyed, not re-litigated.
 * @param data The series to draw. May be empty; the frame is then well-formed and empty.
 * @param ctx The measured container — the same one the plan was resolved against.
 * @param policy Optional; defaults to the published policy. Pass the **same** policy the plan
 *   was resolved with, or the plot box this computes will not be the one the rung reasoned
 *   about.
 */
export function resolveFrame(
  plan: ChartPlan,
  data: readonly Series[],
  ctx: SizeContext,
  policy?: Partial<PlanPolicy>,
): ChartFrame {
  const resolved = resolvePolicy(policy)
  const isBar = plan.type === 'bar' || plan.type === 'timebar'
  const chrome = chromeFromPlan(plan, isBar ? resolved.plotInset : 0)

  // Invariant 1: the SIZE comes straight from the resolver's own function, never re-derived.
  const size = resolvePlotBox(ctx, chrome, data.length, resolved)
  const insets = resolvePlotInsets(ctx, chrome, data.length, resolved)

  // The ORIGIN is what `resolvePlotBox()` does not return — it subtracts bands without
  // saying which side they came off. Left-hand bands are the ones that displace the plot.
  const legend = legendBands(plan.legend, data.length, resolved)
  const legendLeft =
    plan.legend.placement === 'external' && plan.legend.position === 'left' ? legend.width : 0
  const legendTop =
    plan.legend.placement === 'external' && plan.legend.position === 'top'
      ? legend.height
      : plan.legend.placement === 'internal' && plan.legend.flow === 'reserved'
        ? legend.height
        : 0
  const legendRight =
    plan.legend.placement === 'external' && plan.legend.position === 'right' ? legend.width : 0
  const boxHeight = Number.isFinite(ctx.height) && ctx.height > 0 ? ctx.height : 0
  const box: Rect = Object.freeze({
    x: 0,
    y: 0,
    width: Number.isFinite(ctx.width) && ctx.width > 0 ? ctx.width : 0,
    height: boxHeight,
  })
  // ⚠ Computed once and used twice. The band the plot's origin is pushed down by and the band
  // the value display paints into are the same band by construction here; two calls would be
  // two chances to pass different arguments, and the disagreement would be invisible — the
  // numbers would both look plausible and the text would sit slightly off its own region.
  const valueHeight = resolvedValueBand(chrome, boxHeight, data.length, resolved)
  const plot: Rect = Object.freeze({
    x: yAxisGutter(plan.axes.y, resolved) + legendLeft + insets.inline,
    y: valueHeight + legendTop + insets.block,
    width: size.width,
    height: size.height,
  })

  const legendRegion = resolveLegendRegion(plan.legend, legend, box, plot)

  const temporal = data.length > 0 && data.every((s) => s.points.every((p) => p.x instanceof Date))

  // Scales are built in ABSOLUTE svg coordinates, so `plot.x`/`plot.y` are the range origins
  // and tick offsets subtract them back off. Building them plot-relative instead would make
  // every mark position depend on remembering to add the origin exactly once.
  const mark = plan.marks.primary
  if (mark.kind === 'funnel' && data.length > 1) {
    throw new Error('@shiftcharts/core: funnel requires exactly one series of ordered stages.')
  }
  const xBin = mark.kind === 'cell' ? plan.aggregate.temporalBin : 'none'
  const sortedX = categoryValues(data, xBin)
  const xd = xDomain(data, xBin)
  const xScaleDomain = mark.kind === 'bar' ? paddedBarDomain(xd, sortedX) : xd
  const yd = yDomain(data, mark)

  /**
   * ⚠ **Both x scales are wrapped into one epoch-milliseconds interface, so that nothing
   * downstream branches on `temporal` a second time.** `scaleUtc` takes a `Date` and
   * `scaleLinear` takes a `number`; left unwrapped, that difference propagates into the tick
   * helper, into the mark helper, and into every future caller, and each site has to remember
   * it. Wrapped, it lives in these four lines and the two branches are visibly parallel.
   */
  const x: AxisScale = temporal
    ? wrapUtc(scaleUtc().domain([new Date(xScaleDomain[0]), new Date(xScaleDomain[1])]).range([plot.x, plot.x + plot.width]))
    : wrapLinear(scaleLinear().domain([xScaleDomain[0], xScaleDomain[1]]).range([plot.x, plot.x + plot.width]))

  const yScale = scaleLinear()
    .domain([yd[0], yd[1]])
    // SVG's y grows downward, so the range is inverted. Getting this the right way up is the
    // difference between a chart and its reflection, and both render without complaint.
    .range([plot.y + plot.height, plot.y])
    // `nice()` is what makes `scale.ticks()` land on round values rather than on the data's
    // own ragged extent — the property `'endpoints'` deliberately does not have.
    .nice(plan.axes.y.ticks.mode === 'count' ? plan.axes.y.ticks.count : 5)

  // A horizontal bar chart keeps the same zero-baseline value semantics, but values travel
  // along x and categories occupy evenly spaced y bands. This is intentionally resolved in
  // the frame (where values exist), not the planner (which only sees data shape).
  const barValueXScale =
    mark.kind === 'bar' && plan.orientation === 'horizontal'
      ? scaleLinear()
          .domain([yd[0], yd[1]])
          .range([plot.x, plot.x + plot.width])
          .nice(plan.axes.y.ticks.mode === 'count' ? plan.axes.y.ticks.count : 5)
      : null
  const barCategoryY =
    barValueXScale === null
      ? null
      : new Map(sortedX.map((value, index) => [value, plot.y + ((index + 0.5) * plot.height) / Math.max(1, sortedX.length)]))

  const toX = (v: number | Date): number => x.at(v instanceof Date ? v.getTime() : v)

  // Category centres are shared across series so grouped bars keep the same slot even when one
  // series has a missing value. The smallest positive gap is the nominal category width. The
  // bar-only domain padding above means the first and last centres are no longer on the plot
  // edge, while the clamp in `seriesFrame` remains a final finite-box safety net.
  const categoryStep = sortedX.reduce((smallest, value, index) => {
    const previous = sortedX[index - 1]
    if (previous === undefined || value <= previous) return smallest
    return Math.min(smallest, Math.abs(toX(value) - toX(previous)))
  }, Number.POSITIVE_INFINITY)
  const nominalCategoryStep = Number.isFinite(categoryStep) && categoryStep > 0 ? categoryStep : plot.width

  const series = data.map((s, index) =>
    seriesFrame(
      s,
      index,
      mark,
      plan.aggregate,
      plot,
      toX,
      yScale,
      data.length,
      nominalCategoryStep,
      sortedX,
      heatmapExtent(data),
      plan.type === 'funnel',
      plan.orientation,
      barValueXScale,
      barCategoryY,
    ),
  )

  // `'endpoints'` labels the first and last *data* point, so it needs the x values in order —
  // across all series, since the earliest and latest may come from different ones.
  const [ylo, yhi] = yScale.domain()

  // The band sits at the top of the box, below a top-placed external legend and to the right
  // of a left-placed one — the same composition `plot`'s origin uses, and stated the same way
  // so the two cannot drift apart.
  const value =
    plan.narrative.valueDisplay === 'none'
      ? null
      : fitValueDisplay(
          plan.narrative,
          series,
          Object.freeze({
            x: legendLeft,
            y: legendTop,
            width: Math.max(0, box.width - legendLeft - legendRight),
            height: valueHeight,
          }),
          resolved,
          plan.type === 'donut' || mark.kind === 'arc'
            ? 'donut-total'
            : plan.type === 'funnel' && plan.sizeClass === 'micro'
              ? 'funnel-conversion'
              : 'latest',
        )

  return Object.freeze({
    box,
    plot,
    legend: legendRegion,
    xTicks:
      barValueXScale === null
        ? computeTicks(
            plan.axes.x.ticks,
            x,
            sortedX,
            (v) => mark.kind === 'cell' && temporal
              ? formatHeatmapXLabel(new Date(v))
              : formatXLabel(temporal ? new Date(v) : v),
            temporal,
            plot.x,
            plan.axes.x.tickExtra,
          )
        : computeTicks(
            plan.axes.y.ticks,
            wrapLinear(barValueXScale),
            [yd[0], yd[1]],
            formatYLabel,
            false,
            plot.x,
            plan.axes.y.tickExtra,
          ),
    yTicks:
      barCategoryY !== null
        ? barCategoryTicks(data, sortedX, barCategoryY, plot)
        : mark.kind === 'cell'
        ? heatmapRowTicks(series, plot)
        : computeTicks(
            plan.axes.y.ticks,
            wrapLinear(yScale),
            [ylo ?? 0, yhi ?? 0],
            formatYLabel,
            false,
            plot.y,
            plan.axes.y.tickExtra,
          ),
    series: Object.freeze(series),
    zeroLine: barValueXScale === null && (ylo ?? 0) <= 0 && (yhi ?? 0) >= 0 ? yScale(0) : null,
    value,
  })
}

/** Horizontal bars make categories the y-axis. Preserve an explicit category where supplied. */
function barCategoryTicks(
  data: readonly Series[],
  categories: readonly number[],
  positions: ReadonlyMap<number, number>,
  plot: Rect,
): readonly ComputedTick[] {
  return Object.freeze(
    categories.flatMap((value) => {
      const source = data.flatMap((series) => series.points).find((point) => xValue(point) === value)
      const y = positions.get(value)
      if (source === undefined || y === undefined) return []
      return [Object.freeze({
        value,
        offset: y - plot.y,
        label: source.category ?? formatXLabel(source.x),
      })]
    }),
  )
}

function wrapLinear(s: LinearScale): AxisScale {
  return { at: (v) => s(v), ticks: (n) => s.ticks(n) }
}

function wrapUtc(s: ScaleTime<number, number>): AxisScale {
  return { at: (v) => s(new Date(v)), ticks: (n) => s.ticks(n).map((d) => d.getTime()) }
}

function xValue(p: DataPoint): number {
  return p.x instanceof Date ? p.x.getTime() : p.x
}

const DAY_MS = 86_400_000
const WEEK_MS = DAY_MS * 7

function heatmapXValue(x: number | Date, temporalBin: ChartPlan['aggregate']['temporalBin']): number {
  const value = x instanceof Date ? x.getTime() : x
  if (temporalBin !== 'weekly' || !Number.isFinite(value) || !(x instanceof Date)) return value
  return Math.floor((value + DAY_MS * 3) / WEEK_MS) * WEEK_MS - DAY_MS * 3
}

function heatmapExtent(data: readonly Series[]): readonly [number, number] {
  let lo = Number.POSITIVE_INFINITY
  let hi = Number.NEGATIVE_INFINITY
  for (const series of data) {
    for (const point of series.points) {
      if (point.y === null || !Number.isFinite(point.y)) continue
      lo = Math.min(lo, point.y)
      hi = Math.max(hi, point.y)
    }
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [0, 1]
  return [lo, hi]
}

function heatmapIntensity(value: number, lo: number, hi: number): number {
  if (hi === lo) return 1
  const span = hi - lo
  if (!Number.isFinite(span)) return value === hi ? 1 : value === lo ? 0 : value > 0 ? 1 : 0
  // A sequential ramp cannot distinguish a small negative from zero when both land in the
  // minimum bucket. Reserve the midpoint for zero whenever the domain crosses it, giving
  // negative readings their own lower half of the ramp and preserving a visible sign change.
  if (lo < 0 && hi > 0) {
    if (value < 0) return Math.max(0, Math.min(0.5, (value - lo) / (-lo) * 0.5))
    return Math.max(0.5, Math.min(1, 0.5 + (value / hi) * 0.5))
  }
  const ratio = (value - lo) / span
  return Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) : value > 0 ? 1 : 0
}

/**
 * Heatmap rows are categorical series, not positions on the numeric value scale. The generic
 * y-axis tick resolver is correct for line/bar charts but would label these rows with values
 * such as `18`, even though the cells are placed by row index. Keep the row label and its stable
 * series identity in the same computed-tick seam the SVG axis already renders.
 */
function heatmapRowTicks(series: readonly SeriesFrame[], plot: Rect): readonly ComputedTick[] {
  if (series.length === 0 || plot.height <= 0) return Object.freeze([])
  const rowHeight = plot.height / series.length
  return Object.freeze(
    series.map((item, index) =>
      Object.freeze({
        value: item.id,
        offset: rowHeight * (index + 0.5),
        label: item.label,
      }),
    ),
  )
}

/** One series' geometry, keyed off the mark kind the plan chose. */
function seriesFrame(
  s: Series,
  index: number,
  mark: ChartPlan['marks']['primary'],
  aggregate: ChartPlan['aggregate'],
  plot: Rect,
  toX: (v: number | Date) => number,
  yScale: LinearScale,
  seriesCount: number,
  categoryStep: number,
  heatmapColumns: readonly number[],
  heatmapValueExtent: readonly [number, number],
  funnelSummary: boolean,
  orientation: ChartPlan['orientation'],
  barValueXScale: LinearScale | null,
  barCategoryY: ReadonlyMap<number, number> | null,
): SeriesFrame {
  const defined = (p: DataPoint): boolean => p.y !== null && Number.isFinite(p.y)

  const points: PointPos[] = []
  for (const p of s.points) {
    if (!defined(p)) continue
    points.push(
      Object.freeze({ x: toX(p.x), y: yScale(p.y as number), value: p.y as number }),
    )
  }

  let line: string | null = null
  let area: string | null = null
  let bands: readonly HorizonBand[] = []
  let cells: readonly CellFrame[] = []
  let arcs: readonly ArcFrame[] = []
  let progress: ProgressFrame | null = null
  let funnel: FunnelFrame | null = null

  if (mark.kind === 'line') {
    // ⚠ `.defined()` is what makes `y: null` a gap rather than an interpolation. Without it
    // d3 draws straight through the hole, asserting a measurement nobody took.
    const gen = d3Line<DataPoint>()
      .defined(defined)
      .x((p) => toX(p.x))
      .y((p) => yScale(p.y as number))
      .digits(PATH_DIGITS)
    line = gen(s.points as DataPoint[])

    if (mark.area) {
      const areaGen = d3Area<DataPoint>()
        .defined(defined)
        .x((p) => toX(p.x))
        .y0(plot.y + plot.height)
        .y1((p) => yScale(p.y as number))
        .digits(PATH_DIGITS)
      area = areaGen(s.points as DataPoint[])
    }
  } else if (mark.kind === 'horizon') {
    bands = horizonBands(s.points, mark.bands, plot, toX, defined)
  } else if (mark.kind === 'cell') {
    cells = heatmapCells(
      s,
      index,
      seriesCount,
      plot,
      heatmapColumns,
      heatmapValueExtent,
      aggregate.temporalBin,
    )
  } else if (mark.kind === 'bar') {
    if (orientation === 'horizontal' && barValueXScale !== null && barCategoryY !== null) {
      const categoryHeight = Math.max(1, plot.height / Math.max(1, barCategoryY.size) * 0.8)
      const slotHeight = mark.grouped ? categoryHeight / Math.max(1, seriesCount) : categoryHeight
      const barHeight = Math.max(1, slotHeight * 0.9)
      const baseline = barValueXScale(0)
      const cellsArr: CellFrame[] = []
      const barPoints: PointPos[] = []

      for (const source of s.points) {
        if (!defined(source)) continue
        const categoryY = barCategoryY.get(xValue(source))
        if (categoryY === undefined) continue
        const slotOffset = mark.grouped ? (index - (seriesCount - 1) / 2) * slotHeight : 0
        const rawY = categoryY + slotOffset - barHeight / 2
        const maxY = Math.max(plot.y, plot.y + plot.height - barHeight)
        const y = Math.min(maxY, Math.max(plot.y, rawY))
        const valueX = barValueXScale(source.y as number)
        cellsArr.push(
          Object.freeze({
            x: Math.min(baseline, valueX),
            y,
            width: Math.max(0.5, Math.abs(baseline - valueX)),
            height: barHeight,
          }),
        )
        barPoints.push(Object.freeze({ x: valueX, y: categoryY + slotOffset, value: source.y as number }))
      }
      cells = Object.freeze(cellsArr)
      points.splice(0, points.length, ...barPoints)
    } else {
    const categoryWidth = Math.max(1, categoryStep * 0.8)
    const slotWidth = mark.grouped ? categoryWidth / Math.max(1, seriesCount) : categoryWidth
    const barWidth = Math.max(1, slotWidth * 0.9)
    const baseline = yScale(0)
    const cellsArr: CellFrame[] = []

    for (const p of points) {
      const slotOffset = mark.grouped ? (index - (seriesCount - 1) / 2) * slotWidth : 0
      // A category scale maps the first/last datum to the plot edges. Keep grouped bars inside
      // that finite plot rather than letting the half-slot overhang the SVG at either endpoint.
      const rawX = p.x + slotOffset - barWidth / 2
      const maxX = Math.max(plot.x, plot.x + plot.width - barWidth)
      const x = Math.min(maxX, Math.max(plot.x, rawX))
      const y = Math.min(baseline, p.y)
      cellsArr.push(
        Object.freeze({
          x,
          y,
          width: barWidth,
          height: Math.max(0.5, Math.abs(baseline - p.y)),
        }),
      )
    }
    cells = Object.freeze(cellsArr)
    }
  } else if (mark.kind === 'arc') {
    arcs = donutArcs(s, aggregate, plot)
  } else if (mark.kind === 'progress') {
    progress = progressFrame(s, mark.orientation, plot)
  } else if (mark.kind === 'funnel' || funnelSummary) {
    funnel = funnelFrame(
      s,
      mark.kind === 'funnel' ? mark.orientation : 'vertical',
      mark.kind === 'funnel' ? mark.detail : 'summary',
      plot,
    )
  }

  return Object.freeze({
    id: s.id,
    label: s.label ?? s.id,
    index,
    unit: s.unit ?? null,
    target: s.target !== undefined && s.target !== null && Number.isFinite(s.target) ? s.target : null,
    status: s.status ?? null,
    line,
    area,
    bands,
    cells,
    arcs,
    progress,
    funnel,
    points: Object.freeze(points),
    extrema: extremaOf(points),
  })
}

/** Build the complete rectangular heatmap grid, including explicit missing cells. */
function heatmapCells(
  series: Series,
  row: number,
  seriesCount: number,
  plot: Rect,
  columns: readonly number[],
  valueExtent: readonly [number, number],
  temporalBin: ChartPlan['aggregate']['temporalBin'],
): readonly CellFrame[] {
  if (columns.length === 0 || seriesCount === 0) return Object.freeze([])

  const columnIndex = new Map(columns.map((column, index) => [column, index]))
  const values = new Map<number, number | null>()
  const rawColumns = new Set<number>()
  for (const point of series.points) {
    const rawColumn = xValue(point)
    if (rawColumns.has(rawColumn)) {
      throw new Error(`@shiftcharts/core: heatmap series '${series.id}' has duplicate cell '${rawColumn}'.`)
    }
    rawColumns.add(rawColumn)
    const column = heatmapXValue(point.x, temporalBin)
    const index = columnIndex.get(column)
    if (index === undefined) continue
    if (values.has(column)) {
      if (temporalBin !== 'weekly') {
        throw new Error(`@shiftcharts/core: heatmap series '${series.id}' has duplicate cell '${column}'.`)
      }
      const previous = values.get(column)!
      const current = point.y !== null && Number.isFinite(point.y) ? point.y : null
      values.set(column, previous === null ? current : current === null ? previous : previous + current)
      continue
    }
    values.set(column, point.y !== null && Number.isFinite(point.y) ? point.y : null)
  }

  const cellWidth = plot.width / columns.length
  const cellHeight = plot.height / seriesCount
  const [lo, hi] = valueExtent
  return Object.freeze(
    columns.map((column, columnNumber) => {
      const value = values.get(column) ?? null
      const intensity =
        value === null
          ? null
          : heatmapIntensity(value, lo, hi)
      return Object.freeze({
        id: `${series.id}:${column}`,
        x: plot.x + columnNumber * cellWidth,
        y: plot.y + row * cellHeight,
        width: Math.max(0, cellWidth),
        height: Math.max(0, cellHeight),
        value,
        intensity,
        column: columnNumber,
        row,
      })
    }),
  )
}

const FUNNEL_BAND_RATIO = 0.72

/** Resolve ordered funnel stages into finite, stable geometry and relative semantics. */
function funnelFrame(
  series: Series,
  orientation: 'horizontal' | 'vertical',
  _detail: 'summary' | 'stages' | 'dropoff' | 'breakdown',
  plot: Rect,
): FunnelFrame {
  const ordered = [...series.points]
    .map((point, index) => {
      const x = xValue(point)
      if (!Number.isFinite(x)) {
        throw new Error(`@shiftcharts/core: funnel stage ${index} requires a finite x value.`)
      }
      return { point, x, index }
    })
    .sort((a, b) => a.x - b.x)

  const seen = new Set<number>()
  for (const entry of ordered) {
    if (seen.has(entry.x)) {
      throw new Error(`@shiftcharts/core: funnel series '${series.id}' has duplicate stage '${entry.x}'.`)
    }
    seen.add(entry.x)
    if (entry.point.y !== null && (!Number.isFinite(entry.point.y) || entry.point.y < 0)) {
      throw new Error(`@shiftcharts/core: funnel stage '${entry.x}' requires a finite non-negative value.`)
    }
  }

  const stages = ordered.filter(
    (entry): entry is typeof entry & { point: DataPoint & { y: number } } =>
      entry.point.y !== null && Number.isFinite(entry.point.y),
  )
  if (stages.length === 0) return Object.freeze({ stages: Object.freeze([]), overallConversion: null })

  const first = stages[0]?.point.y ?? 0
  const max = stages.reduce((value, entry) => Math.max(value, entry.point.y), 0)
  const rowHeight = stages.length > 0 ? plot.height / stages.length : 0
  const barHeight = Math.max(0, Math.min(rowHeight, rowHeight * FUNNEL_BAND_RATIO))
  const output: FunnelStageFrame[] = []

  stages.forEach((entry, index) => {
    const value = entry.point.y
    const share = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0
    const conversion = first > 0 ? Math.max(0, Math.min(1, value / first)) : null
    const previous = stages[index - 1]?.point.y
    const dropoff = previous === undefined || previous <= 0 ? null : Math.max(0, Math.min(1, (previous - value) / previous))
    const width = orientation === 'vertical' ? plot.width * share : plot.width * share
    const height = orientation === 'vertical' ? barHeight : barHeight * share
    const x = orientation === 'vertical' ? plot.x + (plot.width - width) / 2 : plot.x
    const y = plot.y + index * rowHeight + (rowHeight - height) / 2

    output.push(
      Object.freeze({
        id: `${series.id}:${entry.x}`,
        label: entry.point.category ?? formatXLabel(entry.point.x),
        index,
        value,
        share,
        conversion,
        dropoff,
        x,
        y,
        width: Math.max(0, width),
        height: Math.max(0, height),
        labelWidth: Math.max(0, plot.width),
      }),
    )
  })

  const last = output[output.length - 1]
  return Object.freeze({
    stages: Object.freeze(output),
    overallConversion: last?.conversion ?? null,
  })
}

/** Resolve one series into target-aware progress semantics and finite SVG geometry. */
function progressFrame(
  series: Series,
  orientation: 'horizontal' | 'radial',
  plot: Rect,
): ProgressFrame {
  const currentPoint = [...series.points]
    .reverse()
    .find((point) => point.y !== null && Number.isFinite(point.y))
  const current = currentPoint?.y ?? null
  const target =
    series.target !== undefined && series.target !== null && Number.isFinite(series.target)
      ? series.target
      : null
  const validTarget = target !== null && target > 0
  const ratio = current !== null && validTarget ? Math.max(0, Math.min(1, current / target)) : null
  const remaining = current !== null && validTarget ? Math.max(0, target - current) : null
  const overTarget = current !== null && validTarget ? Math.max(0, current - target) : null
  const indeterminate = current === null || !validTarget

  if (orientation === 'horizontal') {
    const height = Math.max(0, Math.min(plot.height, plot.height * 0.3))
    const y = plot.y + Math.max(0, (plot.height - height) / 2)
    const track = Object.freeze({ x: plot.x, y, width: plot.width, height })
    const fill =
      ratio === null
        ? null
        : Object.freeze({ x: plot.x, y, width: plot.width * ratio, height })
    return Object.freeze({
      orientation,
      current,
      target,
      ratio,
      remaining,
      overTarget,
      indeterminate,
      track,
      fill,
      trackPath: null,
      fillPath: null,
      cx: null,
      cy: null,
      innerRadius: null,
      outerRadius: null,
    })
  }

  const cx = plot.x + plot.width / 2
  const cy = plot.y + plot.height / 2
  const outerRadius = Math.max(0, Math.min(plot.width, plot.height) / 2)
  const innerRadius = outerRadius * 0.55
  const startAngle = -Math.PI / 2
  const fullEndAngle = startAngle + Math.PI * 2
  const pathFor = (endAngle: number): string | null => {
    if (outerRadius <= 0 || endAngle <= startAngle) return null
    return (
      d3Arc<object>()
        .innerRadius(innerRadius)
        .outerRadius(outerRadius)
        .startAngle(startAngle)
        .endAngle(endAngle)
        .digits(PATH_DIGITS)({}) ?? null
    )
  }
  return Object.freeze({
    orientation,
    current,
    target,
    ratio,
    remaining,
    overTarget,
    indeterminate,
    track: null,
    fill: null,
    trackPath: pathFor(fullEndAngle),
    fillPath: ratio === null || ratio <= 0 ? null : pathFor(startAngle + ratio * Math.PI * 2),
    cx: outerRadius > 0 ? cx : null,
    cy: outerRadius > 0 ? cy : null,
    innerRadius: outerRadius > 0 ? innerRadius : null,
    outerRadius: outerRadius > 0 ? outerRadius : null,
  })
}

type DonutSlice = {
  readonly key: string
  readonly label: string
  readonly value: number
  readonly other: boolean
}

/**
 * Resolve category values into stable donut geometry. This is frame work, not planner work:
 * the plan decides whether/when aggregation is allowed, while the frame sees the values and
 * preserves the named `Other` bucket instead of silently dropping a category.
 */
function donutArcs(
  series: Series,
  aggregate: ChartPlan['aggregate'],
  plot: Rect,
): readonly ArcFrame[] {
  const byKey = new Map<string, { label: string; value: number; order: number }>()
  for (const [order, point] of series.points.entries()) {
    if (point.y === null) continue
    if (!Number.isFinite(point.y) || point.y < 0) {
      throw new Error(`@shiftcharts/core: donut series "${series.id}" requires finite non-negative values.`)
    }
    if (point.y === 0) continue
    const key = point.x instanceof Date ? `date:${point.x.getTime()}` : `number:${point.x}`
    const existing = byKey.get(key)
    if (existing === undefined) {
      byKey.set(key, { label: point.category ?? formatXLabel(point.x), value: point.y, order })
    } else {
      existing.value += point.y
    }
  }

  const raw = [...byKey.entries()]
    .sort(([, left], [, right]) => left.order - right.order)
    .map(([key, item]) => ({ key, label: item.label, value: item.value, other: false }))
  const total = raw.reduce((sum, slice) => sum + slice.value, 0)
  if (total <= 0 || !Number.isFinite(total)) return Object.freeze([])

  const limit = aggregate.after === null ? null : Math.max(1, Math.floor(aggregate.after))
  const retained = new Set<string>()
  if (limit !== null && raw.length > limit) {
    for (const slice of [...raw].sort((left, right) => right.value - left.value).slice(0, limit)) {
      retained.add(slice.key)
    }
  }

  let otherValue = 0
  const visible: DonutSlice[] = []
  for (const slice of raw) {
    const tiny = aggregate.minShare !== null && slice.value / total < aggregate.minShare
    const overLimit = limit !== null && raw.length > limit && !retained.has(slice.key)
    if (tiny || overLimit) otherValue += slice.value
    else visible.push(slice)
  }
  if (otherValue > 0) {
    visible.push({ key: 'other', label: 'Other', value: otherValue, other: true })
  }

  const cx = plot.x + plot.width / 2
  const cy = plot.y + plot.height / 2
  const outerRadius = Math.max(0, Math.min(plot.width, plot.height) / 2)
  const innerRadius = outerRadius * 0.55
  let angle = -Math.PI / 2
  const result: ArcFrame[] = []
  for (const slice of visible) {
    const startAngle = angle
    const endAngle = startAngle + (slice.value / total) * Math.PI * 2
    angle = endAngle
    const path = d3Arc<object>()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius)
      .startAngle(startAngle)
      .endAngle(endAngle)
      .digits(PATH_DIGITS)({})
    if (path === null) continue
    result.push(
      Object.freeze({
        id: `${series.id}:${slice.key}`,
        label: slice.label,
        value: slice.value,
        share: slice.value / total,
        startAngle,
        endAngle,
        cx,
        cy,
        innerRadius,
        outerRadius,
        d: path,
        other: slice.other,
      }),
    )
  }
  return Object.freeze(result)
}

function extremaOf(points: readonly PointPos[]): SeriesFrame['extrema'] {
  if (points.length === 0) return null
  let min = 0
  let max = 0
  for (let i = 1; i < points.length; i += 1) {
    const v = points[i]?.value ?? 0
    if (v < (points[min]?.value ?? 0)) min = i
    if (v > (points[max]?.value ?? 0)) max = i
  }
  return Object.freeze({ min, max, last: points.length - 1 })
}

/**
 * The horizon construction: fold the value range into `n` bands, each drawn at the plot's
 * full height, negatives mirrored.
 *
 * ⚠ **This is why Tile drops to a horizon below 24 px rather than shrinking the line.** Heer
 * 2009 measured that a line degrades below ~24 px of plot and that the published fix is to
 * *change encoding*, not to scale down. A horizon trades vertical resolution for layered
 * opacity, so it keeps reading at heights where a line has none left — which is exactly the
 * substitution `./rungs/line.ts` performs and `PlanPolicy.substitute` gates.
 *
 * Each band gets its own clamped scale over its own slice of the domain, so a value inside
 * band *i* draws at full height in band *i* and flat in every band above it. Clamping is what
 * produces the flat top; without it the upper bands would draw off-plot and the layering
 * would invert.
 */
function horizonBands(
  points: readonly DataPoint[],
  count: 1 | 2 | 3,
  plot: Rect,
  toX: (v: number | Date) => number,
  defined: (p: DataPoint) => boolean,
): readonly HorizonBand[] {
  let maxAbs = 0
  for (const p of points) {
    if (p.y !== null && Number.isFinite(p.y)) maxAbs = Math.max(maxAbs, Math.abs(p.y))
  }
  if (maxAbs === 0) return []

  const step = maxAbs / count
  const hasNegative = points.some((p) => p.y !== null && p.y < 0)
  const out: HorizonBand[] = []

  for (const sign of hasNegative ? ([1, -1] as const) : ([1] as const)) {
    for (let band = 0; band < count; band += 1) {
      const lo = band * step
      const hi = (band + 1) * step
      const bandScale = scaleLinear()
        .domain([lo, hi])
        .range([plot.y + plot.height, plot.y])
        .clamp(true)

      const gen = d3Area<DataPoint>()
        .defined(defined)
        .x((p) => toX(p.x))
        .y0(plot.y + plot.height)
        .y1((p) => bandScale(sign * (p.y as number)))
        .digits(PATH_DIGITS)

      const d = gen(points as DataPoint[])
      if (d !== null) out.push(Object.freeze({ sign, band, d }))
    }
  }

  return Object.freeze(out)
}
