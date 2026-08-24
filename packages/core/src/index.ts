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
 * ⚠ **The registered families are `'line'`, `'area'`, `'bar'`, `'timebar'`, `'scatter'`,
 * `'donut'`, `'kpi'`, and `'progress'`.** The
 * `ChartPlan` contract, `PlanPolicy`, `measureText()`, size classification and `planChart()`
 * itself are all here, while every other `ChartType` throws with the D milestone that adds it.
 * A silent fallback plan would be the same failure species as happy-dom's `0`.
 *
 * ⚠ `ChartPlan['type']` is `ChartType | (string & {})`, which is **wider than the ten
 * literals on purpose**: a consumer may plan a type this package has no rung set for, and
 * `planChart()` is the thing that refuses it, with a message naming the milestone. The
 * `& {}` is what keeps the ten in editor completion instead of collapsing to `string`.
 * `plan.ts` carries the full argument.
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
  DEFAULT_SIZE_DEADBAND_FRACTION,
  DEFAULT_NOMINAL_CELL_SIZE,
  resolveAspect,
  resolveSizeClass,
  resolveSizeClassWithDeadband,
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
  CHROME_METRICS,
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

// --- A4: where data enters -----------------------------------------------------------------

// The canonical series shape. Plain and serialisable, so it crosses the RSC boundary as a
// prop — see `./data.ts` for why accessor functions could not.
export type { DataPoint, MetricStatus, Series } from './data.ts'
export { describeShape } from './data.ts'

// Controlled, serialisable interaction identity/state. Tooltip placement and React event layers
// stay in the later I1.2–I1.5 tasks; this module only owns the pure contract.
export type {
  DatumIdentity,
  InteractionState,
  InteractionStateInput,
  InteractionStateUpdate,
  InteractionValidationCode,
  LegendVisibilityState,
  TooltipMode,
  TooltipState,
} from './interaction-state.ts'
export {
  InteractionValidationError,
  createDatumIdentity,
  createInteractionState,
  datumIdentityKey,
  normalizeInteractionState,
  reconcileInteractionState,
  updateInteractionState,
} from './interaction-state.ts'

// Deterministic, DOM-free tooltip geometry. Rendering and event ownership stay outside core.
export type {
  FixedTooltipRail,
  FluidTooltipSide,
  TooltipAnchor,
  TooltipBox,
  TooltipPlacement,
  TooltipPlacementInput,
  TooltipPlacementMode,
  TooltipPlacementSide,
  TooltipPlacementStatus,
  TooltipPlacementValidationCode,
} from './tooltip-placement.ts'
export {
  TooltipPlacementValidationError,
  placeTooltip,
} from './tooltip-placement.ts'

// The one place a value becomes a string, so that the resolver's `labelMaxChars` and the
// renderer's glyphs cannot disagree.
export { formatXLabel, formatYLabel } from './format.ts'

// Plan + data + pixel box → coordinates. The only module in this package that sees values.
export type {
  ChartFrame,
  ArcFrame,
  ComputedTick,
  HorizonBand,
  PointPos,
  ProgressFrame,
  Rect,
  SeriesFrame,
  CellFrame,
  ValueDelta,
  ValueEntry,
  ValueFrame,
} from './frame.ts'
export { resolveFrame } from './frame.ts'

// Pure dashboard layout values. The grid package owns placement UI; core owns the
// serialisable identity/layout boundary consumed by that UI and by host persistence.
export type {
  LayoutSnapshot,
  LayoutValidationCode,
  WidgetId,
  WidgetLayout,
  WidgetLayoutConstraints,
  WidgetLayoutInput,
} from './widget-layout.ts'
export {
  GRID_COLUMNS,
  LAYOUT_SCHEMA_VERSION,
  LayoutValidationError,
  createLayoutSnapshot,
  createWidgetId,
  createWidgetLayout,
  parseLayoutSnapshot,
  serializeLayoutSnapshot,
  validateWidgetLayouts,
} from './widget-layout.ts'
