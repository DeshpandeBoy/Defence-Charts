/**
 * `@gx/core` — the brain. Pure, isomorphic, and deliberately ignorant of both React
 * and the DOM.
 *
 * ⚠ Two bans hold in this package and are enforced, not merely documented:
 *
 *   1. No `react` import.        — dependency-cruiser, gate **G1**
 *   2. No DOM measurement API.   — ESLint `no-restricted-globals`/`no-restricted-syntax`,
 *      gate **G2**. `getComputedTextLength`, `getBBox`, `getTotalLength` and
 *      `getBoundingClientRect` are unavailable here on purpose: jsdom *throws* on all
 *      four and happy-dom silently returns `0`, so a label-collision bug written against
 *      them would pass tests forever. Text width comes from a character-advance model
 *      instead (`research/41-text-metrics.md`).
 *
 * ⚠ A1 scope. `planChart()` and the `ChartPlan` contract land at **A2/A3** against
 * `research/40-chart-plan.md`. What is here is the one piece of layout math the ladder
 * already specifies exactly.
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
 */
export function tickCountForWidth(width: number): number {
  if (!Number.isFinite(width) || width <= 0) return 2
  return Math.max(2, Math.round(width / 100))
}

/** Placeholder for the A2 contract, so the package graph is real at A1. */
export type ChartType = 'line' | 'area'
