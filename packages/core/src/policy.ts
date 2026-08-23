/**
 * `PlanPolicy` and `PlanOverrides` — the two things a consumer can move, and the reason
 * they are two things rather than one.
 *
 * Transcribed from `research/40-chart-plan.md` §5.
 *
 * `research/20-architecture.md` §3.2 fixes the precedence chain:
 * library defaults → `<GxConfig>` → per-chart props → `planFn` last.
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
import type { FontMetrics } from './text.ts'
import { PROVISIONAL_FONT_METRICS } from './text.ts'

/**
 * **INPUT** to `planChart()`. Plan-input tokens per `research/20-architecture.md` §3.2 —
 * TypeScript objects delivered through `<GxConfig>`, **never CSS custom properties**.
 *
 * ⚠ The class boundary is the whole point of decision 10. These values change what the
 * resolver *decides*, so they cannot travel as CSS: the resolver does not read the
 * cascade, and a value it cannot read cannot be one it depends on. Presentation tokens
 * (colour, radii, `font-family`) go the other way — CSS only, never an input here.
 *
 * Every field carries its provenance tier. A-lit is published and cited; B is ours and
 * consistent with the corpus; C is ours and unsourced. The tiers are not decoration —
 * they say which numbers may be moved on taste and which may not be moved without new
 * evidence.
 */
export type PlanPolicy = {
  /** px between ticks. **A-lit** — Talbot 2010. */
  readonly tickTargetSpacing: number
  /** **A-lit** — Talbot 2010. */
  readonly ticksMin: number
  /** In `em`, not px. **A-lit** — Talbot 2010. */
  readonly labelMinSpacing: number

  /** px. Optimal plot height for a line; below it, change encoding. **A-lit** — Heer 2009. */
  readonly plotHeightOptimal: number
  /** px. Below it, value-estimation error rises, p < 0.001. **A-lit** — Heer & Bostock 2010. */
  readonly plotHeightMinValues: number
  /** px. Little benefit beyond. **A-lit** — Heer & Bostock 2010. */
  readonly plotHeightSaturation: number

  /** px. A 2-band horizon is still readable here. **A-lit** — Heer 2009. */
  readonly horizonMinHeight: number
  /** **A-lit** — Heer 2009. The cap is a finding, not a style choice. */
  readonly horizonMaxBands: 1 | 2 | 3

  /** Slices past which a radial encoding stops being readable. **A-lit**. */
  readonly categoriesMaxRadial: number

  /**
   * Categories past which the resolver buckets into "Other". **B**.
   *
   * ⚠ Appears here *and* as `ChartPlan.aggregate.after`, and that is not duplication:
   * policy states the threshold, the plan records what was decided. They differ whenever
   * a rung aggregates more aggressively than the threshold — which several do.
   */
  readonly aggregateAfter: number

  /** **C**. */
  readonly legendMaxEntries: number
  /** Points past which `marks.renderer` flips to canvas. **C**. */
  readonly pointBudget: number

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
   * px floor for a heatmap cell; below it, bin coarser rather than shrinking further
   * (`research/10-responsive-ladder.md` §4 Heatmap). **C**.
   *
   * ⚠ **UNVERIFIED, and do not repair the citation.** The corpus is explicit: the 8 px
   * *"coincides numerically with Heer & Bostock's gridline result, but that finding is
   * about tracing gridlines to labels. **Do not cite it.**"* A plausible-looking citation
   * attached to the wrong finding is worse than an admitted gap, because it stops anyone
   * from checking.
   *
   * ⚠ Unrelated to grid-cell geometry despite the name — see the open question on
   * `resolveSizeClass` in `./context.ts`, which is a *different* missing number.
   */
  readonly minCellSize: number

  /**
   * The character-advance table (`research/41-text-metrics.md`).
   *
   * ⚠ A plan input rather than a hidden constant, because six CSS properties change the
   * outcome of a fit-or-collide decision. A consumer who overrides `--gx-font-family` with
   * a wider face and *cannot* also move the metrics gets a planner that says the labels fit
   * while the browser collides them. Moving one without the other is the supported footgun;
   * it is named in `research/20-architecture.md` §3.2 rather than prevented, because
   * preventing it would mean the resolver reading CSS.
   */
  readonly fontMetrics: FontMetrics
}

/**
 * **APPLIED AFTER** resolution. Forced values, deep-partial.
 *
 * ⚠ Unions are **atomic** here — see `DeepPartial`. You may not half-override a
 * discriminated union.
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
 * The `[T] extends [...]` brackets suppress distribution — without them the conditional
 * splits the union apart before `IsUnion` can observe that it was one.
 */
export type DeepPartial<T> = [T] extends [readonly unknown[]]
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
 * ⚠ `fontMetrics` defaults to `PROVISIONAL_FONT_METRICS`, which is a **typed hole, not a
 * measurement** — see its docblock in `./text.ts`. Every width it reports is a deliberate
 * over-estimate, so any label-degradation behaviour observed against this default is
 * provisional.
 */
export const DEFAULT_POLICY: PlanPolicy = Object.freeze({
  tickTargetSpacing: 100,
  ticksMin: 2,
  labelMinSpacing: 1.5,
  plotHeightOptimal: 24,
  plotHeightMinValues: 40,
  plotHeightSaturation: 80,
  horizonMinHeight: 6,
  horizonMaxBands: 3,
  categoriesMaxRadial: 7,
  aggregateAfter: 8,
  legendMaxEntries: 8,
  pointBudget: 2000,
  substitute: true,
  minCellSize: 8,
  fontMetrics: PROVISIONAL_FONT_METRICS,
}) satisfies PlanPolicy

/**
 * `DEFAULT_POLICY` merged with a caller's partial.
 *
 * ⚠ Shallow by design. Every `PlanPolicy` field is a scalar except `fontMetrics`, and
 * `fontMetrics` must be replaced whole rather than merged: a table half from the reference
 * face and half from somewhere else describes no real font, and `generatedWith` would then
 * describe only part of its own table. That is the `tnum` trap wearing a different hat.
 */
export function resolvePolicy(policy?: Partial<PlanPolicy>): PlanPolicy {
  if (policy === undefined) return DEFAULT_POLICY
  return Object.freeze({ ...DEFAULT_POLICY, ...policy })
}
