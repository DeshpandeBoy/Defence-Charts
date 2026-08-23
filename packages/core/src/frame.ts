/**
 * The frame — a `ChartPlan` plus real data plus a pixel box, resolved into coordinates.
 *
 * A plan says *what* to draw and, by `research/40-chart-plan.md` §1.3 containment, is
 * forbidden from saying *where*: no field may be named `width`, `height` or `margin`, and
 * `PlotBox` is *"not a `ChartPlan` field and never will be"* (`./layout.ts`). So a plan alone
 * cannot be rendered. This module supplies the missing half, and it is the only module in
 * `@gx/core` that sees actual values.
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
import type { DataPoint, Series } from './data.ts'
import { formatXLabel, formatYLabel } from './format.ts'
import {
  CHROME_METRICS,
  legendBands,
  resolvePlotBox,
  valueBand,
  yAxisGutter,
  type ChromeSpec,
} from './layout.ts'
import type { ChartPlan, NarrativePlan, TickPlan } from './plan.ts'
import type { PlanPolicy } from './policy.ts'
import { resolvePolicy } from './policy.ts'
import { measureText, RANK_FONT_SIZE } from './text.ts'
import type { TypeRank } from './text-types.ts'

import { extent } from 'd3-array'
import { scaleLinear, scaleUtc, type ScaleLinear, type ScaleTime } from 'd3-scale'
import { area as d3Area, line as d3Line } from 'd3-shape'

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
  /** 0-based, and the index into the `--gx-series-N` colour ramp. */
  readonly index: number
  /** `null` when the mark kind is not `'line'`, or when nothing is defined. */
  readonly line: string | null
  /** `null` unless the plan asked for an area. */
  readonly area: string | null
  /** Empty unless the mark kind is `'horizon'`. */
  readonly bands: readonly HorizonBand[]
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
      /** The series' human label. Not painted at A4; see `ValueEntry` below. */
      readonly label: string
      /** The formatted latest value. */
      readonly text: string
      /** `'latest+delta'` only, and only when a previous defined point exists. */
      readonly delta: {
        readonly text: string
        readonly direction: 'up' | 'down' | 'flat'
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
 * ⚠ `label` is carried and not painted, which is deliberate rather than dead. The frame is
 * the coordinate contract, and a consumer laying out their own value display needs the
 * pairing; inside this repo the pairing is carried by the data table, which
 * `./rungs/line.ts` keeps `present: true` at every rung that asks for a value display. What
 * ties a painted number to its series today is colour — `<ValueDisplay>` emits
 * `data-series-index` and `chart.css` binds the same six-colour ramp the marks use.
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
export function chromeFromPlan(plan: ChartPlan): ChromeSpec {
  return {
    x: plan.axes.x,
    y: plan.axes.y,
    y2: plan.axes.y2,
    legend: plan.legend,
    valueDisplay: plan.narrative.valueDisplay,
    valueTypeScale: plan.narrative.valueTypeScale,
    tableDisclosure: plan.dataTable.disclosure,
    tablePresent: plan.dataTable.present,
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

function xDomain(data: readonly Series[]): readonly [number, number] {
  const values: number[] = []
  for (const s of data) {
    for (const p of s.points) {
      const v = p.x instanceof Date ? p.x.getTime() : p.x
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
 * ⚠ **Zero is not forced into the y domain, and that is the right default for a line.**
 * Forcing zero is a *bar* convention — a bar encodes value by length, so a truncated baseline
 * lies about ratios. A line encodes value by position, and forcing zero on a series that
 * varies between 990 and 1010 flattens it into a horizontal rule that shows nothing. Cleveland
 * and every charting library that has thought about it split the same way.
 *
 * `hasNegative` therefore does not change the domain here. It reaches the plan, where it
 * belongs, and `zeroLine` below gives the renderer the baseline to draw when zero is in view.
 */
function yDomain(data: readonly Series[]): readonly [number, number] {
  const values: number[] = []
  for (const s of data) {
    for (const p of s.points) {
      if (p.y !== null && Number.isFinite(p.y)) values.push(p.y)
    }
  }
  const [lo, hi] = extent(values)
  if (lo === undefined || hi === undefined) return [0, 1]
  return padDegenerate(lo, hi)
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
  const ticks: ComputedTick[] = []
  for (const value of scale.ticks(count)) {
    const tick = toTick(value)
    if (seen.has(tick.value)) continue
    seen.add(tick.value)
    ticks.push(tick)
  }
  return Object.freeze(ticks)
}

// --- The value display -------------------------------------------------------------------

/**
 * ⚠ **Rank A, and the choice is the advance table rather than the size.** `./layout.ts`
 * fits the value display by *budget*, not by rank — `valueTypeScale: 'fit'` means "as large
 * as the band allows" — so no rank supplies the font size here. What a rank supplies is a
 * measured advance table, and `FontMetrics.byRank` is measured per variable-font instance:
 * rank A is the 700-weight instance, which is the weight `--gx-value-label-font-weight`
 * paints at. Measuring a bold number against the 400-weight table under-estimates its
 * width, and under-estimating width is the direction `./text.ts` §6.1 forbids.
 */
const VALUE_RANK: TypeRank = 'A'

/**
 * ⚠ **The legibility floor, taken from core rather than from a token.** 10 px agrees
 * numerically with `--gx-label-font-size-min`, and it is read from `RANK_FONT_SIZE.E`
 * anyway, for the reason `CHROME_METRICS` states about tick length: this number is folded
 * into a layout decision — how many values are shown — so a theme that moved the token
 * would change what a reader sees while the frame went on reporting the old count. Numbers
 * the resolver subtracts against are core's; numbers only the painter reads are the theme's.
 */
const VALUE_MIN_FONT_SIZE = RANK_FONT_SIZE.E

/** Breathing room between adjacent value columns; the same gap that separates regions. */
const VALUE_COLUMN_GUTTER = CHROME_METRICS.regionGap

/**
 * Width of `text` per 1 px of font size.
 *
 * Exact, not an approximation: every rank's `letterSpacing` is `0`, so `measureText()`
 * reduces to `sum × fontSize × safetyFactor` and dividing by the rank's own font size
 * recovers `sum × safetyFactor` — a pure ratio. If a rank ever gains letter-spacing this
 * stops being exact in the *narrow* direction, so it would have to be reworked rather than
 * left; `./text.ts` §6 is the standing note on which direction is safe.
 */
function emAdvance(text: string, policy: PlanPolicy): number {
  return measureText(text, VALUE_RANK, policy.typography.metrics) / RANK_FONT_SIZE[VALUE_RANK]
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
 * count from all-of-them down to one, and the first that reaches `VALUE_MIN_FONT_SIZE` wins.
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
 * The effective floor is `min(VALUE_MIN_FONT_SIZE, verticalFit)`: when the band itself is
 * shorter than 10 px of type, no entry count helps, because the vertical fit does not depend
 * on the count. Reducing to one entry and rendering it as large as the resolver's own band
 * permits is then the honest outcome — the alternative is the empty band.
 */
function fitValueDisplay(
  narrative: NarrativePlan,
  series: readonly SeriesFrame[],
  region: Rect,
  policy: PlanPolicy,
): ChartFrame['value'] {
  const empty = Object.freeze({ region, fontSize: 0, entries: Object.freeze([]), overflow: null })

  // "Latest" is the last point whose `y` is non-null, and `SeriesFrame.points` holds only
  // defined points in data order — so it is the last element, and a series with no defined
  // point contributes no entry at all. Not a '—' entry: a placeholder in a value display is a
  // reading of the data, and there is no reading to give.
  const drafts = series.flatMap((s) => {
    const last = s.points[s.points.length - 1]
    if (last === undefined) return []
    const previous = s.points[s.points.length - 2]
    return [
      {
        seriesId: s.id,
        seriesIndex: s.index,
        label: s.label,
        text: formatYLabel(last.value),
        delta:
          narrative.valueDisplay === 'latest+delta' && previous !== undefined
            ? deltaOf(last.value - previous.value)
            : null,
      },
    ]
  })
  if (drafts.length === 0) return empty

  // The painted string, which is the string measured. The gap between a value and its delta
  // is a space *inside* the text rather than a `dx` on the tspan, so that the width fitted is
  // the width drawn; a gap added after measurement is a gap the fit does not know about.
  const painted = (d: (typeof drafts)[number]): string =>
    d.delta === null ? d.text : `${d.text} ${d.delta.text}`

  const v = policy.typography.metrics.vertical
  const emHeight = v.ascent + v.descent + v.lineGap
  const verticalFit = emHeight > 0 ? region.height / emHeight : 0
  const floor = Math.min(VALUE_MIN_FONT_SIZE, verticalFit)

  let shown = drafts.length
  let fontSize = 0
  for (let count = drafts.length; count >= 1; count -= 1) {
    const hidden = drafts.length - count
    // The overflow marker is a column, not an annotation squeezed into one.
    const columns = hidden > 0 ? count + 1 : count
    const budget = region.width / columns - VALUE_COLUMN_GUTTER
    let widest = hidden > 0 ? emAdvance(overflowText(hidden), policy) : 0
    for (let i = 0; i < count; i += 1) {
      const draft = drafts[i]
      if (draft !== undefined) widest = Math.max(widest, emAdvance(painted(draft), policy))
    }
    shown = count
    fontSize = floorTo2(Math.min(verticalFit, widest > 0 ? budget / widest : verticalFit))
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
  const chrome = chromeFromPlan(plan)

  // Invariant 1: the SIZE comes straight from the resolver's own function, never re-derived.
  const size = resolvePlotBox(ctx, chrome, data.length, resolved)

  // The ORIGIN is what `resolvePlotBox()` does not return — it subtracts bands without
  // saying which side they came off. Left-hand bands are the ones that displace the plot.
  const legend = legendBands(plan.legend, data.length, resolved)
  const legendLeft =
    plan.legend.placement === 'external' && plan.legend.position === 'left' ? legend.width : 0
  const legendTop =
    plan.legend.placement === 'external' && plan.legend.position === 'top' ? legend.height : 0

  const boxHeight = Number.isFinite(ctx.height) && ctx.height > 0 ? ctx.height : 0
  // ⚠ Computed once and used twice. The band the plot's origin is pushed down by and the band
  // the value display paints into are the same band by construction here; two calls would be
  // two chances to pass different arguments, and the disagreement would be invisible — the
  // numbers would both look plausible and the text would sit slightly off its own region.
  const valueHeight = valueBand(
    plan.narrative.valueDisplay,
    plan.narrative.valueTypeScale,
    boxHeight,
    resolved,
  )
  const plot: Rect = Object.freeze({
    x: yAxisGutter(plan.axes.y, resolved) + legendLeft,
    y: valueHeight + legendTop,
    width: size.width,
    height: size.height,
  })

  const box: Rect = Object.freeze({
    x: 0,
    y: 0,
    width: Number.isFinite(ctx.width) && ctx.width > 0 ? ctx.width : 0,
    height: boxHeight,
  })

  const temporal = data.length > 0 && data.every((s) => s.points.every((p) => p.x instanceof Date))

  // Scales are built in ABSOLUTE svg coordinates, so `plot.x`/`plot.y` are the range origins
  // and tick offsets subtract them back off. Building them plot-relative instead would make
  // every mark position depend on remembering to add the origin exactly once.
  const xd = xDomain(data)
  const yd = yDomain(data)

  /**
   * ⚠ **Both x scales are wrapped into one epoch-milliseconds interface, so that nothing
   * downstream branches on `temporal` a second time.** `scaleUtc` takes a `Date` and
   * `scaleLinear` takes a `number`; left unwrapped, that difference propagates into the tick
   * helper, into the mark helper, and into every future caller, and each site has to remember
   * it. Wrapped, it lives in these four lines and the two branches are visibly parallel.
   */
  const x: AxisScale = temporal
    ? wrapUtc(scaleUtc().domain([new Date(xd[0]), new Date(xd[1])]).range([plot.x, plot.x + plot.width]))
    : wrapLinear(scaleLinear().domain([xd[0], xd[1]]).range([plot.x, plot.x + plot.width]))

  const yScale = scaleLinear()
    .domain([yd[0], yd[1]])
    // SVG's y grows downward, so the range is inverted. Getting this the right way up is the
    // difference between a chart and its reflection, and both render without complaint.
    .range([plot.y + plot.height, plot.y])
    // `nice()` is what makes `scale.ticks()` land on round values rather than on the data's
    // own ragged extent — the property `'endpoints'` deliberately does not have.
    .nice(plan.axes.y.ticks.mode === 'count' ? plan.axes.y.ticks.count : 5)

  const toX = (v: number | Date): number => x.at(v instanceof Date ? v.getTime() : v)
  const mark = plan.marks.primary

  const series = data.map((s, index) => seriesFrame(s, index, mark, plot, toX, yScale))

  // `'endpoints'` labels the first and last *data* point, so it needs the x values in order —
  // across all series, since the earliest and latest may come from different ones.
  const sortedX = [...new Set(data.flatMap((s) => s.points.map(xValue)))].sort((a, b) => a - b)

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
            width: Math.max(0, box.width - legendLeft),
            height: valueHeight,
          }),
          resolved,
        )

  return Object.freeze({
    box,
    plot,
    xTicks: computeTicks(
      plan.axes.x.ticks,
      x,
      sortedX,
      (v) => formatXLabel(temporal ? new Date(v) : v),
      temporal,
      plot.x,
    ),
    yTicks: computeTicks(
      plan.axes.y.ticks,
      wrapLinear(yScale),
      [ylo ?? 0, yhi ?? 0],
      formatYLabel,
      false,
      plot.y,
    ),
    series: Object.freeze(series),
    zeroLine: (ylo ?? 0) <= 0 && (yhi ?? 0) >= 0 ? yScale(0) : null,
    value,
  })
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

/** One series' geometry, keyed off the mark kind the plan chose. */
function seriesFrame(
  s: Series,
  index: number,
  mark: ChartPlan['marks']['primary'],
  plot: Rect,
  toX: (v: number | Date) => number,
  yScale: LinearScale,
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
  }

  return Object.freeze({
    id: s.id,
    label: s.label ?? s.id,
    index,
    line,
    area,
    bands,
    points: Object.freeze(points),
    extrema: extremaOf(points),
  })
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
