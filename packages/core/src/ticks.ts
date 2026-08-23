/**
 * Axis tick density.
 *
 * `research/10-responsive-ladder.md` §6.
 */

import type { PlanPolicy } from './policy.ts'
import { DEFAULT_POLICY } from './policy.ts'

/**
 * Target tick count for a horizontal axis of `width` CSS pixels.
 *
 * `research/10-responsive-ladder.md` §6: `max(2, round(width / 100))`, **with no upper
 * cap**. The absent cap is the specified behaviour, not an oversight — the ladder
 * densifies continuously rather than snapping between breakpoints, and a cap would
 * reintroduce the breakpoint by the back door.
 *
 * Pure: no measurement, no state, no clock. Same input, same output, on a server or in a
 * worker.
 *
 * ⚠ Returns a *count*, which is not the same thing as a `TickPlan`. `{ mode: 'endpoints' }`
 * is a distinct state from `{ mode: 'count', count: 2 }` — see `./plan.ts` — so the
 * resolver decides the mode first and consults this only when the mode is `'count'`.
 *
 * The `100` is `PlanPolicy.tickTargetSpacing` and the `2` is `PlanPolicy.ticksMin`, both
 * A-lit (Talbot 2010). They arrive as arguments rather than as literals, so a consumer who
 * moves `tickTargetSpacing` is not silently ignored on the one axis that uses it.
 *
 * ⚠ `policy` is optional **only** so the A2-era call sites and the playground keep working
 * against the published defaults. `planChart()` always passes a fully resolved policy —
 * `resolvePolicy()` has no partial output — so the default path is unreachable from the
 * resolver. Do not add a second overload that takes a `Partial<PlanPolicy>`; a half-applied
 * policy is the "two spellings of one concept" hazard §1.4 bans.
 *
 * @param width Plot width in px — the plot, not the box. Chrome is already subtracted by
 *   `resolvePlotBox()`, which is §1.3's `y gutter → plot width → x tick count` in order.
 */
export function tickCountForWidth(
  width: number,
  policy: Pick<PlanPolicy, 'tickTargetSpacing' | 'ticksMin'> = DEFAULT_POLICY,
): number {
  const min = Number.isFinite(policy.ticksMin) ? Math.max(0, Math.floor(policy.ticksMin)) : 2
  if (!Number.isFinite(width) || width <= 0) return min

  // A non-positive target spacing would divide by zero or invert the density; fall back to
  // the floor rather than emitting `Infinity`, which §1.4 forbids from ever reaching a plan.
  const spacing = policy.tickTargetSpacing
  if (!Number.isFinite(spacing) || spacing <= 0) return min

  return Math.max(min, Math.round(width / spacing))
}
