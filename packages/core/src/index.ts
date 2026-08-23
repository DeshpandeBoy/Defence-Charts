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
 * ⚠ **A3 scope.** The `ChartPlan` contract, `PlanPolicy`, `measureText()`, size
 * classification and `planChart()` itself are here — but only for `'line'` and `'area'`.
 * Every other `ChartType` throws with the milestone that adds it. A silent fallback plan
 * would be the same failure species as happy-dom's `0`.
 *
 * ⚠ **No renderer.** `@gx/primitives` and `@gx/react` are still empty; A4 fills them. A
 * plan is testable with zero UI, which is the whole point of A3.
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
export {
  DEFAULT_NOMINAL_CELL_SIZE,
  resolveAspect,
  resolveSizeClass,
  sizeContextFromPixels,
} from './context.ts'

// Text width without a DOM.
export type {
  FittingTypography,
  FontMetrics,
  FontRankStyle,
  GlyphAdvances,
  TypeRank,
  VerticalMetrics,
} from './text.ts'
export {
  DEFAULT_TYPOGRAPHY,
  measureText,
  RANK_FONT_SIZE,
} from './text.ts'

// The measured advance table. Generated offline; see `scripts/generate-font-metrics.mjs`.
export { ROBOTO_FLEX_METRICS } from './font-metrics.generated.ts'

// What a consumer may move, before resolution and after.
export type { DeepPartial, PlanChartFn, PlanOverrides, PlanPolicy } from './policy.ts'
export { DEFAULT_POLICY, resolvePolicy } from './policy.ts'

// Axis tick density.
export { tickCountForWidth } from './ticks.ts'

// The plot box, and the two resolution chains that produce it. **Tier B** — the horizontal
// chain is `research/40-chart-plan.md` §1.3 verbatim; the vertical one is ours, because the
// corpus is silent on it and Tile cannot pick its mark without it.
export type { ChromeSpec, LabelDegrade, PlotBox } from './layout.ts'
export {
  degradeXLabels,
  legendBands,
  lineHeight,
  resolvePlotBox,
  tableBand,
  valueBand,
  xAxisBand,
  yAxisGutter,
} from './layout.ts'

// The six line/area rungs, exported individually so a consumer can read one rung's
// semantics without going through the size classifier.
export type { LineChartType, Rung, RungInput } from './rungs/line.ts'
export {
  canvasRung,
  LINE_RUNGS,
  microRung,
  panelRung,
  stageRung,
  stripRung,
  tileRung,
} from './rungs/line.ts'

// Forced values, applied after resolution.
export { applyOverrides } from './overrides.ts'

// The resolver.
export { planChart } from './plan-chart.ts'
