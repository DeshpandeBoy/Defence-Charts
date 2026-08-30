/**
 * The canonical data shape — the first and only place actual values enter this library.
 *
 * ⚠ **This does not weaken `planChart()`'s data-blindness, and the distinction is worth
 * being precise about because it looks like a breach.** `planChart()`'s signature is
 * unchanged: it takes a `DataShape` of counts and never a value. What `describeShape()` adds
 * is a *derivation* of those counts from real data — an optional convenience the caller may
 * use or ignore. The resolver still cannot see a number, a label, or a date.
 *
 * The reason that matters is in `./layout.ts`: *"a resolver that takes label text takes the
 * data, and the whole plan-as-data split depends on it not doing so."* A resolver that could
 * see values would be a resolver whose output could depend on them, and a plan that depends
 * on values cannot be computed from metadata on a server. The wall stays exactly where it
 * was; this module stands on the near side of it.
 *
 * ## Why a canonical shape rather than accessor functions
 *
 * visx and d3 take `data: T[]` plus `x: (d) => …` and `y: (d) => …`, which is ergonomic and
 * would have been the obvious steal. It is wrong here for one structural reason: **decision 7
 * passes this across the RSC boundary as a prop, and a function is not serialisable.** A
 * `<Chart>` rendered in a server component and handed accessors would work only while the
 * whole tree stayed on the server, and would fail the moment anything above it became a
 * client component — with an error about functions not being passable, six frames from the
 * chart.
 *
 * Two consequences fall out of the canonical shape for free, and both would have needed
 * separate machinery under accessors: the `<figcaption>` data table can be generated from the
 * data directly, and `describeShape()` below can exist at all.
 */

import type { DataShape } from './context.ts'
import { formatXLabel, formatYLabel } from './format.ts'

/**
 * One observation.
 *
 * ⚠ **`y: null` is a gap, not a zero**, and it is spelled rather than omitted for the same
 * reason `research/40-chart-plan.md` §1.4 spells `null` in the plan: an absent key and a
 * present-but-empty one are indistinguishable to a reader and different to a renderer.
 * `null` becomes d3-shape's `.defined()` predicate in `./frame.ts`, which breaks the path
 * rather than drawing through the hole. Drawing through it is the failure this type exists to
 * make impossible to express by accident — a line that interpolates across missing data
 * asserts a measurement nobody took.
 */
export type DataPoint = {
  /** A `Date` for a temporal axis, a `number` otherwise. Mixing the two in one series is a
   * caller error and `describeShape()` reports the series as non-temporal. */
  readonly x: number | Date
  /** `null` = no observation at this x. Not zero. */
  readonly y: number | null
  /**
   * An optional human-readable name for this point, such as a donut slice or funnel stage.
   * Falls back to a formatted `x` the same way `Series.label` falls back to `id` — most
   * families ignore it, since `x` is already the label there (an axis position, a date).
   * Donut and funnel have no axis to read a name from, so they read this instead.
   */
  readonly category?: string
}

/** A visible metric state. The word is rendered as text; it is never colour-only. */
export type MetricStatus = 'positive' | 'negative' | 'neutral' | 'warning' | 'critical'

/**
 * One series. KPI qualifiers are optional metadata on the same canonical shape; line, donut, and
 * other families ignore them unless their composition asks for metric output.
 *
 * ⚠ `label` is genuinely optional here, which contradicts the plan's *"spelled, not absent"*
 * rule on purpose. That rule exists because a `ChartPlan` is snapshot-compared and
 * transmitted, so an absent key is a diff hazard. Data is caller input: it is never
 * snapshotted, and requiring `label: null` on every series would be hostile for no benefit.
 * `id` is what the renderer keys on; `label` is what a human reads, and it falls back to `id`.
 */
export type Series = {
  /** Stable across renders. Object constancy during a transition depends on it (`MotionPlan`). */
  readonly id: string
  readonly label?: string
  /** Optional KPI unit, such as `%`, `ms`, or `items`; absent means no suffix. */
  readonly unit?: string | null
  /** Optional KPI target. It is displayed only when finite and present. */
  readonly target?: number | null
  /** Optional KPI state. It is displayed as text and remains meaningful without colour. */
  readonly status?: MetricStatus | null
  readonly points: readonly DataPoint[]
}

/**
 * Real data → the counts the resolver accepts.
 *
 * ⚠ **`labelMaxChars` is measured against the labels that will actually be drawn**: the same
 * `formatXLabel()` `./frame.ts` uses for the fallback case, or `point.category`'s own length
 * when a point supplies one (donut/funnel prefer it over `formatXLabel()` — see `DataPoint`).
 * Skipping the `category` half of that max would under-budget space for exactly the labels
 * this field exists to make legible. That partially closes a gap `./layout.ts` records as
 * open: it notes that `'M'.repeat(n)` is *"a floor on what fits, not a prediction of it"*,
 * because real axis labels — `"Jan 1"`, `"2024"` — are mostly digits and narrow lowercase
 * while `M` is the widest common Latin glyph.
 *
 * The over-estimate does not disappear; `degradeXLabels()` still expands the count back into
 * `M`s, and it still must, because `DataShape` carries no strings. But the count it expands
 * is now the true length of the true label rather than the length of some upstream field, so
 * the error is bounded by one substitution instead of two. Erring wide remains the
 * recoverable direction (`./text.ts` §6.1).
 *
 * ⚠ **`points` is the total across all series, not the longest series.** It is compared
 * against `policy.pointBudget`, which guards *rendering* cost — and the renderer draws every
 * point of every series, so the total is the quantity that decides whether SVG can cope.
 * Reading it as a per-series figure would let six series of 4,000 points each pass a 5,000
 * budget as SVG.
 *
 * ⚠ **`temporal` requires every x in every series to be a `Date`.** A mixed series has no
 * coherent axis, and answering `true` for it would build a time scale over numbers — which
 * d3 does without complaining, producing an axis labelled with instants near the Unix epoch.
 * That is a chart that renders, looks plausible, and is wrong; the conservative answer draws
 * a numeric axis, which is visibly odd and gets reported.
 *
 * Pure: no measurement, no clock, no state.
 */
export function describeShape(data: readonly Series[]): DataShape {
  let points = 0
  let hasNegative = false
  let labelMaxChars = 0
  let yLabelMaxChars = 1
  let temporal = data.length > 0
  const xs = new Set<number>()

  for (const series of data) {
    for (const point of series.points) {
      points += 1

      if (point.x instanceof Date) {
        xs.add(point.x.getTime())
      } else {
        temporal = false
        xs.add(point.x)
      }

      if (point.y !== null && point.y < 0) hasNegative = true

      if (point.y !== null && Number.isFinite(point.y)) {
        // `.nice()` may extend a two-digit domain such as 20…82 to the three-character
        // tick `100`. One extra character keeps that predictable boundary conservative
        // without charging every chart for the old nine-character worst-case sample.
        yLabelMaxChars = Math.max(yLabelMaxChars, formatYLabel(point.y).length + 1)
      }

      const chars = Math.max(formatXLabel(point.x).length, point.category?.length ?? 0)
      if (chars > labelMaxChars) labelMaxChars = chars
    }
  }

  return Object.freeze({
    series: data.length,
    // Distinct x positions. For a line this is the number of slots an axis has to label,
    // which is what `categories` means everywhere else in the plan.
    categories: xs.size,
    points,
    hasNegative,
    labelMaxChars,
    yLabelMaxChars,
    temporal,
  })
}
