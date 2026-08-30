/**
 * `PlanPolicy` and `PlanOverrides` — the two things a consumer can move, and the reason
 * they are two things rather than one.
 *
 * Transcribed from `research/40-chart-plan.md` §5.
 *
 * `research/20-architecture.md` §3.2 fixes the precedence chain:
 * library defaults → `<ShiftChartsConfig>` → per-chart props → `planFn` last.
 *
 * ⚠ **Policy is applied BEFORE resolution; overrides are forced AFTER.** Conflating them
 * is how the token-split bug gets reintroduced, and `aggregateAfter` is the field that
 * makes the ambiguity concrete: as *policy* it is the threshold the resolver consults, as
 * an *override* it is a decided value the resolver is forbidden to revise. One argument
 * cannot mean both. That is why `planChart()` takes five parameters here where
 * `research/20-architecture.md:91` shows four — a deliberate correction, recorded in §5.
 */

import type { DataShape, SizeContext } from './context.ts'
import type { ChartPlan, ChartType } from './plan.ts'
import type { FittingTypography } from './text.ts'
import { DEFAULT_TYPOGRAPHY } from './text.ts'

/**
 * **INPUT** to `planChart()`. Plan-input tokens per `research/20-architecture.md` §3.2 —
 * TypeScript objects delivered through `<ShiftChartsConfig>`, **never CSS custom properties**.
 *
 * ⚠ The class boundary is the whole point of decision 10. These values change what the
 * resolver *decides*, so they cannot travel as CSS: the resolver does not read the
 * cascade, and a value it cannot read cannot be one it depends on. Presentation tokens
 * (colour and radii) go the other way — CSS only, never an input here.
 *
 * Every field carries its provenance tier. A-lit is published and cited; B is ours and
 * consistent with the corpus; C is ours and unsourced. The tiers are not decoration —
 * they say which numbers may be moved on taste and which may not be moved without new
 * evidence.
 */
export type PlanPolicy = {
  /** px between X-axis ticks. **A-lit** — Talbot 2010 / Plot. */
  readonly tickTargetSpacingX: number
  /** **A-lit** — Talbot 2010. */
  readonly ticksMin: number
  /** In `em`, not px. **A-lit** — Talbot 2010. */
  readonly labelMinSpacing: number
  /** Hand-authored Y-axis tick count for value-legible line rungs. **B** — §6. */
  readonly yTickCount: number
  /** Series count after which direct labels externalise into a legend. **B** — §4.4/§6. */
  readonly directLabelMaxSeries: number
  /**
   * Character budget for a direct-end series label. **C** — ours. The renderer caps the
   * inward-anchored label at this length so identity remains compact without consuming a
   * separate legend rail.
   */
  readonly directLabelMaxChars: number
  /** Minimum series count for the optional secondary axis. **C** — §4.1 leaves it open. */
  readonly secondaryAxisMinSeries: number
  /**
   * Maximum small-multiple columns by aspect. **C** — §11 leaves facet sizing open; this
   * keeps the current aspect-derived fallback typed until measured cell sizing lands.
   */
  readonly facetColumnsByAspect: Readonly<Record<SizeContext['aspect'], number>>
  /** px. Tick mark length. **C**. */
  readonly tickLength: number
  /** px. Gap between tick and label. **C**. */
  readonly tickLabelGap: number
  /** px. Gap between labels and axis title. **C**. */
  readonly axisTitleGap: number
  /** px. Width of the axis rule itself. **C**. */
  readonly axisRuleWidth: number
  /** px. Gap between the legend/table band and the plot. **C**. */
  readonly regionGap: number
  /** px. Symmetric breathing room inside the resolved plot rectangle. **C**. */
  readonly plotInset: number

  /**
   * Value-domain policy for line and area charts. **C** — explicit consumer semantics.
   * `data` preserves the truthful position-encoding default; the other modes are opt-in.
   */
  readonly lineYDomainMode: 'data' | 'include-zero' | 'symmetric' | 'fixed'
  /** Finite lower bound required when `lineYDomainMode` is `fixed`; otherwise `null`. */
  readonly lineYDomainMin: number | null
  /** Finite upper bound required when `lineYDomainMode` is `fixed`; otherwise `null`. */
  readonly lineYDomainMax: number | null

  /** px. Optimal plot height for a line; below it, change encoding. **A-lit** — Heer 2009. */
  readonly plotHeightOptimal: number
  /**
   * @future
   * px. Below it, value-estimation error rises, p < 0.001. **A-lit** — Heer & Bostock 2010.
   * Reserved for the value-legibility decisions of future non-line rungs; the current line
   * ladder selects its rung from `SizeContext.sizeClass` and does not reclassify from px.
   */
  readonly plotHeightMinValues: number
  /**
   * @future
   * px. Little benefit beyond. **A-lit** — Heer & Bostock 2010. Reserved for future content
   * expansion decisions; it is not a second threshold in the current line/area rungs.
   */
  readonly plotHeightSaturation: number

  /** px. A 2-band horizon is still readable here. **A-lit** — Heer 2009. */
  readonly horizonMinHeight: number
  /**
   * @future
   * **A-lit** — Heer 2009. The cap is a finding, not a style choice. The current Tile rung
   * deliberately uses one band; future horizon-capable rungs will consume this upper bound.
   */
  readonly horizonMaxBands: 1 | 2 | 3

  /**
   * @future
   * Slices past which a radial encoding stops being readable. **A-lit**. Reserved for the
   * future donut/radial resolver; line/area never creates slices.
   */
  readonly categoriesMaxRadial: number

  /**
   * @future
   * Categories past which the resolver buckets into "Other". **B**.
   *
   * ⚠ Appears here *and* as `ChartPlan.aggregate.after`, and that is not duplication:
   * policy states the threshold, the plan records what was decided. They differ whenever
   * a rung aggregates more aggressively than the threshold — which several do.
   *
   * Line/area explicitly returns `after: null` because bucketing a time series into `Other`
   * is not a valid decision for this resolver; bar/donut rungs will consume this field.
   */
  readonly aggregateAfter: number

  /** **C**. */
  readonly legendMaxEntries: number
  /** Points past which `marks.renderer` flips to canvas. **C**. */
  readonly pointBudget: number
  /** px. Hide point markers when average horizontal spacing falls below this. **A-impl**. */
  readonly pointAutoHideDensityThreshold: number

  /**
   * Whether the resolver may swap one encoding for another — line → horizon at
   * `horizonMinHeight`, bar → dot, and so on (§5.6).
   *
   * ⚠ **This is policy, not an override.** A consumer pinning substitution off changes
   * *how the resolver decides*, not *what it decided*. Expressing the same intent as
   * `overrides.marks.primary` would force one specific mark at every rung and break §1.1's
   * requirement that each rung carry a complete, independently-valid spec.
   */
  readonly substitute: boolean

  /**
   * @future
   * px floor for a heatmap cell; below it, bin coarser rather than shrinking further
   * (`research/10-responsive-ladder.md` §4 Heatmap). **C**.
   *
   * ⚠ **UNVERIFIED, and do not repair the citation.** The corpus is explicit: the 8 px
   * *"coincides numerically with Heer & Bostock's gridline result, but that finding is
   * about tracing gridlines to labels. **Do not cite it.**"* A plausible-looking citation
   * attached to the wrong finding is worse than an admitted gap, because it stops anyone
   * from checking.
   *
   * ⚠ Unrelated to grid-cell geometry despite the name — standalone grid geometry uses
   * `DEFAULT_NOMINAL_CELL_SIZE` in `./context.ts`, a different Tier C number.
   * This remains reserved for the future heatmap binning resolver; line/area has no cells.
   */
  readonly minCellSize: number

  /**
   * Fraction of the box the value region may claim, `0..1`. **C** — ours, unsourced.
   *
   * ⚠ **Added at A3, and it amends `research/40-chart-plan.md` §5.** The §5 list has no
   * such field because §5 predates the vertical-layout question, which A3 discovered:
   * the Tile rung picks its mark by measured plot height, plot height needs the value
   * region's height, and the value region asks for `valueTypeScale: 'fit'`.
   *
   * ⚠ Resolving `'fit'` as **a budget rather than a type size** is what closes §11 item 2
   * (*"Until `FontMetrics` exists, `'fit'` is unimplementable"*). The band is decided from
   * the box alone; the renderer then fits type within it. Nothing measures a value string
   * at plan time, so no metrics table is required and the region provably cannot grow the
   * box. See `./layout.ts`.
   *
   * A share rather than a px figure so it degrades sensibly at every rung instead of
   * starving the small ones.
   */
  readonly valueRegionMaxShare: number

  /**
   * Fraction (0..1) of a bar category's nominal step the category's full box occupies,
   * before any per-series division. **A-impl** — derived as `1 - bar-gap-outer` from
   * `@shiftcharts/tokens`' `bar-gap-outer: 0.2`, itself cited to Highcharts'
   * `groupPadding: 0.2` and cross-checked against Nivo/Recharts.
   *
   * ⚠ Stored as the CONTENT side of the ratio, not the gap side the token name uses, so the
   * geometry that reads it (`./frame.ts`) multiplies directly with no subtraction. Move this
   * and `bar-gap-outer` together, or the CSS token and the geometry it was meant to describe
   * drift apart the way they already had before this field existed.
   */
  readonly barCategoryShare: number
  /**
   * Fraction (0..1) of a bar's slot — the category box, divided by series count when
   * grouped — the drawn bar occupies. **A-impl** — derived as `1 - bar-gap-inner` from
   * `@shiftcharts/tokens`' `bar-gap-inner: 0.1`, itself cited to Highcharts'
   * `pointPadding: 0.1`. Same content-side storage as `barCategoryShare`, same reason.
   */
  readonly barFillShare: number

  /**
   * All six fit-sensitive typography values plus the character-advance table measured
   * under them (`research/41-text-metrics.md`). Replaced whole so a caller cannot move the
   * rendered font while leaving the planner's table behind.
   */
  readonly typography: FittingTypography
}

/**
 * **APPLIED AFTER** resolution. Forced values, deep-partial.
 *
 * ⚠ Unions are **atomic** here — see `DeepPartial`. You may not half-override a
 * discriminated union. A *nullable object* is the one exception, and it is not really one:
 * `axes.y2` takes a partial because `null` is not a variant a key could have belonged to.
 */
export type PlanOverrides = DeepPartial<ChartPlan>

/**
 * Recursively optional, with two deliberate exceptions.
 *
 * ⚠ **Unions are replaced whole, never partialised.** A naive deep-partial would admit
 * `{ legend: { position: 'right' } }` — a `LegendPlan` with a `position` but no
 * `placement`, which after merging yields an object matching no variant. That violates
 * §1.4 (absence is spelled explicitly, never by a missing key) and §1.2 (a plan names
 * states, so a half-named state is not a weaker statement, it is an invalid one). Whole-
 * member replacement is the only merge on a discriminated union that cannot produce a
 * plan the renderer must guess about.
 *
 * ⚠ **Arrays are replaced whole too.** `regionOrder` is an order; a partial order is not a
 * weaker order, it is a different one.
 *
 * ⚠ **`null` is stripped before the union test, and that distinction is the whole subtlety.**
 * `AxisPlan | null` is a union by `IsUnion`'s reckoning, so the rule above would make
 * `axes.y2` atomic and forbid `{ y2: { visible: true } }` outright. But the reason unions are
 * atomic does not apply to it: a partial `LegendPlan` is ambiguous about *which variant* it is
 * completing, whereas a partial `AxisPlan | null` can only be completing the one object member
 * — `null` is not a shape a key can belong to. `./overrides.ts` merges such a patch onto a
 * declared base (`NULL_BASE_DEFAULTS`) and gets a total `AxisPlan` back, which is the
 * behaviour A3 settled on after finding that atomicity *"protects a field from a bad merge;
 * it does not make a partial total."* This clause is what stops the type from forbidding it.
 *
 * The weakening is exactly as narrow as that argument. `Exclude<T, null>` removes `null` and
 * nothing else, and whatever remains still faces the union test — so `MarkSpec | null`, were
 * it ever to exist, would stay atomic and merely gain its `| null` back.
 *
 * The `[T] extends [...]` brackets suppress distribution — without them the conditional
 * splits the union apart before `IsUnion` can observe that it was one.
 */
export type DeepPartial<T> = null extends T
  ? DeepPartialOf<Exclude<T, null>> | null
  : DeepPartialOf<T>

/** `DeepPartial` with the nullable case already peeled off. Not exported; see above. */
type DeepPartialOf<T> = [T] extends [readonly unknown[]]
  ? T
  : IsUnion<T> extends true
    ? T
    : [T] extends [object]
      ? { readonly [K in keyof T]?: DeepPartial<T[K]> }
      : T

/** `true` iff `T` is a union of two or more members. */
type IsUnion<T, U = T> = T extends unknown ? ([U] extends [T] ? false : true) : never

/**
 * The signature `planChart()` will implement at **A3**.
 *
 * ⚠ Declared as a type here, ahead of the implementation, so that A3 cannot quietly drift
 * from §5 — the parameter order and the policy/overrides split are the contract, and a
 * function written first tends to become the contract by default.
 */
export type PlanChartFn = (
  type: ChartType,
  ctx: SizeContext,
  shape: DataShape,
  policy?: Partial<PlanPolicy>,
  overrides?: PlanOverrides,
) => ChartPlan

/**
 * Library defaults — the first link in the `research/20-architecture.md` §3.2 precedence
 * chain.
 *
 * ⚠ The A-lit numbers are not preferences. Moving `plotHeightMinValues` off 40 discards a
 * published result (Heer & Bostock 2010, p < 0.001) rather than expressing taste. The C
 * numbers are genuinely open and may be moved freely.
 *
 * ⚠ `typography.metrics` is a **typed hole, not a measurement** — see its docblock in
 * `./text.ts`. Every width it reports is a deliberate over-estimate, so any
 * label-degradation behaviour observed against this default is provisional.
 */
export const DEFAULT_POLICY: PlanPolicy = Object.freeze({
  tickTargetSpacingX: 100,
  ticksMin: 2,
  labelMinSpacing: 1.5,
  yTickCount: 4,
  directLabelMaxSeries: 4,
  directLabelMaxChars: 8,
  secondaryAxisMinSeries: 2,
  facetColumnsByAspect: Object.freeze({
    portrait: 2,
    square: 2,
    landscape: 3,
    ultrawide: 4,
  }),
  tickLength: 4,
  tickLabelGap: 3,
  axisTitleGap: 4,
  axisRuleWidth: 1,
  regionGap: 4,
  plotInset: 8,
  lineYDomainMode: 'data',
  lineYDomainMin: null,
  lineYDomainMax: null,
  plotHeightOptimal: 24,
  plotHeightMinValues: 40,
  plotHeightSaturation: 80,
  horizonMinHeight: 6,
  horizonMaxBands: 3,
  categoriesMaxRadial: 7,
  aggregateAfter: 8,
  legendMaxEntries: 8,
  pointBudget: 2000,
  pointAutoHideDensityThreshold: 2,
  substitute: true,
  minCellSize: 8,
  valueRegionMaxShare: 0.5,
  barCategoryShare: 0.8,
  barFillShare: 0.9,
  typography: DEFAULT_TYPOGRAPHY,
}) satisfies PlanPolicy

/**
 * `DEFAULT_POLICY` merged with a caller's partial.
 *
 * ⚠ Shallow by design. `typography` must be replaced whole rather than merged: styles
 * from one face and a table from another describe no real rendered text. That is the
 * `tnum` trap wearing a different hat.
 */
export function resolvePolicy(policy?: Partial<PlanPolicy>): PlanPolicy {
  if (policy === undefined) return DEFAULT_POLICY
  const resolved = { ...DEFAULT_POLICY, ...policy }
  if (resolved.lineYDomainMode === 'fixed') {
    if (
      resolved.lineYDomainMin === null ||
      resolved.lineYDomainMax === null ||
      !Number.isFinite(resolved.lineYDomainMin) ||
      !Number.isFinite(resolved.lineYDomainMax) ||
      resolved.lineYDomainMin >= resolved.lineYDomainMax
    ) {
      throw new Error(
        '@shiftcharts/core: fixed line y-domain requires finite lineYDomainMin < lineYDomainMax.',
      )
    }
  }
  return Object.freeze(resolved)
}
