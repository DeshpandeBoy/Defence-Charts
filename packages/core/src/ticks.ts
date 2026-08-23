/**
 * Axis tick density.
 *
 * `research/10-responsive-ladder.md` §6.
 */

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
 * ⚠ The `100` is `PlanPolicy.tickTargetSpacing` and the `2` is `PlanPolicy.ticksMin`, both
 * A-lit (Talbot 2010). They are hardcoded here only because this function predates
 * `planChart()`; **A3 must route them through policy** or a consumer who moves
 * `tickTargetSpacing` will find it silently ignored on the one axis that uses it.
 */
export function tickCountForWidth(width: number): number {
  if (!Number.isFinite(width) || width <= 0) return 2
  return Math.max(2, Math.round(width / 100))
}
