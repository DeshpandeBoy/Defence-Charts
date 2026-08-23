/**
 * `@gx/core` — the brain. Pure, isomorphic, and deliberately ignorant of both React
 * and the DOM.
 *
 * ⚠ Two bans hold in this package and are enforced, not merely documented:
 *
 *   1. No `react` import.        — dependency-cruiser, gate **G1**
 *   2. No DOM measurement API.   — ESLint `no-restricted-globals`/`no-restricted-syntax`,
 *      gate **G2**, plus `"types": []` in this package's tsconfig so the DOM lib is not
 *      even in scope. `getComputedTextLength`, `getBBox`, `getTotalLength` and
 *      `getBoundingClientRect` are unavailable here on purpose: jsdom *throws* on all
 *      four and happy-dom silently returns `0`, so a label-collision bug written against
 *      them would pass tests forever. Text width comes from a character-advance model
 *      instead (`./text.ts`, `research/41-text-metrics.md`).
 *
 * ⚠ **A2 scope.** The `ChartPlan` contract, `PlanPolicy`, `measureText()` and size
 * classification are here. `planChart()` itself — the resolver that turns
 * `(type, ctx, shape)` into a plan — lands at **A3**. Its signature is pinned as
 * `PlanChartFn` in `./policy.ts` so the implementation cannot quietly drift from
 * `research/40-chart-plan.md` §5.
 *
 * This file is a barrel and nothing else. Everything it names is defined in a sibling
 * module, so there is exactly one place to read for any given contract.
 */

// The public contract: what a plan *is*.
export type {
  AggregatePlan,
  AxesPlan,
  AxisPlan,
  ChartPlan,
  ChartType,
  DataTablePlan,
  DegradeStep,
  FacetPlan,
  InteractionPlan,
  LabelsPlan,
  LegendPlan,
  MarkSpec,
  MarksPlan,
  MotionPlan,
  NarrativePlan,
  PointPlan,
  RegionName,
  SizeClass,
  TickPlan,
  ValueLegibility,
} from './plan.ts'
export { AXIS_OFF } from './plan.ts'

// The resolver's two inputs, and the size classification they carry.
export type { DataShape, SizeContext } from './context.ts'
export { resolveAspect, resolveSizeClass } from './context.ts'

// Text width without a DOM.
export type { FontMetrics, GlyphAdvances, TypeRank, VerticalMetrics } from './text.ts'
export { measureText, PROVISIONAL_FONT_METRICS, RANK_FONT_SIZE } from './text.ts'

// What a consumer may move, before resolution and after.
export type { DeepPartial, PlanChartFn, PlanOverrides, PlanPolicy } from './policy.ts'
export { DEFAULT_POLICY, resolvePolicy } from './policy.ts'

// Axis tick density.
export { tickCountForWidth } from './ticks.ts'
