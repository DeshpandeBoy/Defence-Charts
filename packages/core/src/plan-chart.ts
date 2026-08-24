/**
 * `planChart()` — the resolver.
 *
 * `research/30-implementation-plan.md:197` states A3's whole payoff: *"At the end of A3 the
 * core thesis is testable with zero UI. That is the point."* This is the function that makes
 * it so. Everything upstream of here is a contract; everything downstream is a renderer.
 *
 * Three steps and nothing else:
 *
 *   1. `resolvePolicy(policy)` — defaults merged, before resolution.
 *   2. Dispatch by `ctx.sizeClass` to the rung set for `type`.
 *   3. `applyOverrides(plan, overrides)` — forced values, after resolution.
 *
 * ⚠ **Pure, and that is a load-bearing property rather than a nicety.** No DOM, no clock, no
 * randomness, no memory of previous calls. Decision 7's server-rendered path is provable
 * only because the same inputs produce the same plan on a server, in a worker, and in a
 * browser — and gate **G10** asserts the "no memory" half by sweeping width up through every
 * boundary and back down.
 *
 * ⚠ **There is no `prevClass` parameter and there will not be one** (§9). Hysteresis is an
 * animation concern, handled at A6. A resolver that remembers is a resolver whose output
 * depends on the direction you approached from, and G10 exists to stop that arriving as a
 * "small fix".
 */

import type { DataShape, SizeContext } from './context.ts'
import { findBuiltInPlanner } from './planner-registry.ts'
import { applyOverrides } from './overrides.ts'
import type { ChartPlan, ChartType } from './plan.ts'
import type { PlanChartFn, PlanOverrides, PlanPolicy } from './policy.ts'
import { resolvePolicy } from './policy.ts'

/**
 * The milestone that adds each remaining type, quoted back in the error rather than kept in
 * a plan document nobody reads at 2am.
 */
const TYPE_MILESTONE: Readonly<Partial<Record<ChartType, string>>> = Object.freeze({
  bar: 'D',
  timebar: 'D',
  donut: 'D',
  scatter: 'D',
  funnel: 'D',
  kpi: 'D',
  heatmap: 'D',
  progress: 'D',
})

/**
 * `(type, ctx, shape)` → a complete `ChartPlan`.
 *
 * Assigned to `PlanChartFn` rather than typed inline, so the parameter order and the
 * policy/overrides split cannot drift from §5 — a function written first tends to become the
 * contract by default, and §5's contract predates this file deliberately.
 *
 * ⚠ **Unimplemented types throw.** A silent fallback — returning a line plan for a funnel, or
 * an empty plan — is worse than a crash: it is the same failure species as happy-dom's `0`,
 * a thing that looks like it works and quietly doesn't. The message names the milestone.
 *
 * @param type Chart type. Registered family entries resolve; unsupported types throw with their milestone.
 * @param ctx The measured container. `sizeClass` picks the rung; raw px refine within it.
 * @param shape What the data looks like — never the data itself.
 * @param policy Applied **before** resolution; changes how the resolver decides.
 * @param overrides Applied **after**; changes what it decided.
 */
export const planChart: PlanChartFn = (
  type: ChartType,
  ctx: SizeContext,
  shape: DataShape,
  policy?: Partial<PlanPolicy>,
  overrides?: PlanOverrides,
): ChartPlan => {
  const planner = findBuiltInPlanner(type)
  if (planner === undefined) {
    const milestone = TYPE_MILESTONE[type]
    throw new Error(
      milestone === undefined
        ? `planChart: unknown chart type ${JSON.stringify(type)}.`
        : `planChart: chart type ${JSON.stringify(type)} has no rung set yet; it lands at ` +
          `milestone ${milestone}. Registered families are explicit and never fall back to line.`,
    )
  }

  const resolved = resolvePolicy(policy)
  const plan = planner.plan({
    type,
    ctx,
    shape,
    policy: resolved,
  })
  return applyOverrides(plan, overrides)
}
