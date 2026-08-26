/**
 * Activity heatmap family planner.
 *
 * Heatmap is deliberately a family-local extension of the shared ChartPlan. The shared
 * fields carry the renderer seam (`MarkSpec.kind: 'cell'`), generic interaction, table, and
 * responsive chrome. The `heatmap` block records the activity-specific information state until
 * the coordinator promotes that block into the central plan/frame contract.
 *
 * This planner is data-blind: it receives only DataShape. Cell values, missing-cell identity,
 * duplicate-x validation, ordering, and intensity normalisation belong to the value-aware frame.
 * No branch below samples or drops points. The point budget only chooses the renderer mode.
 */

import type { DataShape, SizeContext } from '../../context.ts'
import type { FamilyPlanner, FamilyPlannerInput } from '../../family-seam.ts'
import {
  AXIS_OFF,
  type AggregatePlan,
  type AxisPlan,
  type ChartPlan,
  type ChartType,
  type DataTablePlan,
  type InteractionPlan,
  type LabelsPlan,
  type LegendPlan,
  type MarkSpec,
  type MarksPlan,
  type MotionPlan,
  type NarrativePlan,
  type RegionName,
} from '../../plan.ts'
import type { PlanPolicy } from '../../policy.ts'
import { tickCountForWidth } from '../../ticks.ts'

export type HeatmapChartType = Extract<ChartType, 'heatmap'>

export const HEATMAP_CHART_TYPES: readonly HeatmapChartType[] = Object.freeze(['heatmap'])

export type HeatmapRange = 'total' | 'recent-weeks' | 'full-range'
export type HeatmapWeekdayLabels = 'none' | 'axis-intent' | 'spelled'
export type HeatmapMonthLabels = 'none' | 'axis-intent'
export type HeatmapIntensityLegend = 'none' | 'external'
export type HeatmapCellValues = 'none' | 'hover'
export type HeatmapStreakAnnotations = 'none' | 'visible'
export type HeatmapKeyboardNavigation = 'widget' | 'cells'

/**
 * Family-specific information and accessibility state.
 *
 * These fields are plain data rather than renderer instructions. In particular, `range` does
 * not encode a hard-coded number of weeks: the frame/host owns the configured recent window.
 * `cellBudget` is the same Tier-C rendering budget as `marks.pointBudget`, named here so a
 * heatmap consumer cannot mistake it for permission to sample cells.
 */
export type HeatmapSemantics = {
  readonly range: HeatmapRange
  readonly weekdayLabels: HeatmapWeekdayLabels
  readonly monthLabels: HeatmapMonthLabels
  readonly intensityLegend: HeatmapIntensityLegend
  readonly cellValues: HeatmapCellValues
  readonly streakAnnotations: HeatmapStreakAnnotations
  readonly cellBudget: number
  /** Project-owned nominal floor; Tier C, not a perception citation. */
  readonly nominalCellFloorPx: number
  readonly nominalCellFloorTier: 'C'
  readonly accessibility: {
    /** Visible/static non-colour semantics supplied by the table/frame seam. */
    readonly cellText: 'summary' | 'table' | 'table-and-hover'
    readonly keyboard: HeatmapKeyboardNavigation
  }
}

/** The complete serialisable heatmap plan returned by the family-local planner. */
export type HeatmapPlan = ChartPlan & {
  readonly heatmap: HeatmapSemantics
}

const SIZE_CLASSES: readonly SizeContext['sizeClass'][] = Object.freeze([
  'micro',
  'tile',
  'strip',
  'panel',
  'canvas',
  'stage',
])

const ASPECTS: readonly SizeContext['aspect'][] = Object.freeze([
  'portrait',
  'square',
  'landscape',
  'ultrawide',
])

function isFiniteNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0
}

function isFiniteNonNegativeInteger(value: number): boolean {
  return isFiniteNonNegative(value) && Number.isInteger(value)
}

function assertDataShape(shape: DataShape): void {
  if (!isFiniteNonNegativeInteger(shape.series)) {
    throw new Error('@shiftcharts/core: heatmap shape.series must be a finite non-negative integer.')
  }
  if (!isFiniteNonNegativeInteger(shape.categories)) {
    throw new Error('@shiftcharts/core: heatmap shape.categories must be a finite non-negative integer.')
  }
  if (!isFiniteNonNegativeInteger(shape.points)) {
    throw new Error('@shiftcharts/core: heatmap shape.points must be a finite non-negative integer.')
  }
  if (!isFiniteNonNegativeInteger(shape.labelMaxChars)) {
    throw new Error('@shiftcharts/core: heatmap shape.labelMaxChars must be a finite non-negative integer.')
  }
  if (typeof shape.hasNegative !== 'boolean' || typeof shape.temporal !== 'boolean') {
    throw new Error('@shiftcharts/core: heatmap shape flags must be booleans.')
  }

  // An empty state has no x values from which to infer temporal-ness. A populated activity
  // heatmap must be temporal; numeric/non-temporal shapes belong to another family or frame
  // contract and must fail explicitly instead of receiving a misleading weekday grid.
  if (shape.points > 0 && !shape.temporal) {
    throw new Error('@shiftcharts/core: heatmap requires temporal data when points are present.')
  }
}

function assertContext(ctx: SizeContext): void {
  if (!SIZE_CLASSES.includes(ctx.sizeClass)) {
    throw new Error(`@shiftcharts/core: heatmap does not support size class '${String(ctx.sizeClass)}'.`)
  }
  if (!isFiniteNonNegative(ctx.width) || !isFiniteNonNegative(ctx.height)) {
    throw new Error('@shiftcharts/core: heatmap context dimensions must be finite and non-negative.')
  }
  if (!isFiniteNonNegativeInteger(ctx.cols) || !isFiniteNonNegativeInteger(ctx.rows)) {
    throw new Error('@shiftcharts/core: heatmap context grid dimensions must be finite non-negative integers.')
  }
  if (!ASPECTS.includes(ctx.aspect)) {
    throw new Error(`@shiftcharts/core: heatmap does not support aspect '${String(ctx.aspect)}'.`)
  }
}

function assertPolicy(policy: PlanPolicy): void {
  if (!isFiniteNonNegativeInteger(policy.pointBudget)) {
    throw new Error('@shiftcharts/core: heatmap point/cell budget must be a finite non-negative integer.')
  }
  if (!Number.isFinite(policy.minCellSize) || policy.minCellSize <= 0) {
    throw new Error('@shiftcharts/core: heatmap nominal cell floor must be a finite positive number.')
  }
  if (!isFiniteNonNegativeInteger(policy.legendMaxEntries) || policy.legendMaxEntries < 1) {
    throw new Error('@shiftcharts/core: heatmap legend capacity must be a finite positive integer.')
  }
}

function visibleAxis(
  ticks: AxisPlan['ticks'],
  options: Pick<AxisPlan, 'domainLine' | 'title' | 'gridlines'>,
): AxisPlan {
  return Object.freeze({
    ...AXIS_OFF,
    visible: true,
    ticks: Object.freeze(ticks),
    ...options,
  })
}

function axisPlan(ctx: SizeContext, policy: PlanPolicy): { readonly x: AxisPlan; readonly y: AxisPlan } {
  return Object.freeze({
    // X carries the full temporal range/month landmark intent. The renderer owns the actual
    // calendar labels; the planner only commits a deterministic tick budget.
    x: visibleAxis(
      { mode: 'count', count: tickCountForWidth(ctx.width, policy) },
      { domainLine: true, title: false, gridlines: false },
    ),
    // Seven is the weekday row count, not an invented numeric value scale.
    y: visibleAxis(
      { mode: 'count', count: 7 },
      { domainLine: false, title: false, gridlines: false },
    ),
  })
}

function weeklyBinRequired(
  sizeClass: SizeContext['sizeClass'],
  ctx: SizeContext,
  shape: DataShape,
  policy: PlanPolicy,
): boolean {
  if (sizeClass === 'micro' || sizeClass === 'tile' || !shape.temporal || shape.categories === 0) return false

  // This is an estimate used only to choose the information state. The actual cell rectangle
  // is frame-owned. The 8px default is project-owned Tier C and is never presented as a
  // perceptual result.
  const estimatedColumn = ctx.width / Math.max(1, shape.categories)
  const estimatedWeekday = ctx.height / 7
  return estimatedColumn < policy.minCellSize || estimatedWeekday < policy.minCellSize
}

function temporalBinFor(
  sizeClass: SizeContext['sizeClass'],
  ctx: SizeContext,
  shape: DataShape,
  policy: PlanPolicy,
): AggregatePlan['temporalBin'] {
  return weeklyBinRequired(sizeClass, ctx, shape, policy) ? 'weekly' : 'none'
}

function aggregatePlan(temporalBin: AggregatePlan['temporalBin']): AggregatePlan {
  return Object.freeze({
    after: null,
    minShare: null,
    otherBucket: false,
    expandable: false,
    temporalBin,
  })
}

function interactionPlan(sizeClass: SizeContext['sizeClass']): InteractionPlan {
  if (sizeClass === 'micro' || sizeClass === 'tile') {
    return Object.freeze({
      trigger: 'none',
      tooltip: Object.freeze({ enabled: false, placement: 'fix' }),
      crosshair: false,
      brush: false,
      zoom: false,
      // An intensity scale is explanatory, not a series visibility control.
      legendToggle: false,
    })
  }

  if (sizeClass === 'strip') {
    return Object.freeze({
      trigger: 'tap',
      tooltip: Object.freeze({ enabled: true, placement: 'fix' }),
      crosshair: false,
      brush: false,
      zoom: false,
      legendToggle: false,
    })
  }

  if (sizeClass === 'panel') {
    return Object.freeze({
      trigger: 'hover',
      tooltip: Object.freeze({ enabled: true, placement: 'fix' }),
      crosshair: true,
      brush: false,
      zoom: false,
      legendToggle: false,
    })
  }

  return Object.freeze({
    trigger: 'hover',
    tooltip: Object.freeze({ enabled: true, placement: 'fluid' }),
    crosshair: true,
    brush: true,
    zoom: true,
    legendToggle: false,
  })
}

function dataTablePlan(sizeClass: SizeContext['sizeClass']): DataTablePlan {
  const compact = sizeClass === 'micro' || sizeClass === 'tile'
  return Object.freeze({
    present: true,
    disclosure: compact ? 'widget-tap' : 'button',
    initiallyExpanded: false,
    columns: compact ? 'summary' : 'all',
  })
}

function narrativePlan(sizeClass: SizeContext['sizeClass']): NarrativePlan {
  return Object.freeze({
    summaryPhrase: sizeClass === 'micro',
    valueDisplay: sizeClass === 'micro' || sizeClass === 'tile' ? 'latest' : 'none',
    valueTypeScale: 'fit',
    deltaBasis: false,
    callouts: 'none',
    annotations: sizeClass === 'stage',
    thresholdBands: false,
  })
}

function labelsPlan(): LabelsPlan {
  return Object.freeze({
    seriesLabels: 'none',
    valueLabels: 'none',
    axisLabelDegrade: 'none',
    maxChars: null,
    labelHalo: 'none',
  })
}

function legendPlan(sizeClass: SizeContext['sizeClass'], policy: PlanPolicy): LegendPlan {
  if (sizeClass !== 'canvas' && sizeClass !== 'stage') return Object.freeze({ placement: 'absent' })
  return Object.freeze({
    placement: 'external',
    position: 'right',
    maxEntries: policy.legendMaxEntries,
    showValues: true,
    showPercent: false,
  })
}

function motionPlan(
  sizeClass: SizeContext['sizeClass'],
  temporalBin: AggregatePlan['temporalBin'],
): MotionPlan {
  const plot = sizeClass !== 'micro' && sizeClass !== 'tile'
  return Object.freeze({
    durationClass: plot ? 'recompose' : 'rescale',
    stages: plot ? 2 : 1,
    persistGridlines: plot,
    objectConstancy: plot || temporalBin === 'weekly',
  })
}

function regionOrder(
  narrative: NarrativePlan,
  mark: MarkSpec,
  legend: LegendPlan,
  table: DataTablePlan,
): readonly RegionName[] {
  const regions: RegionName[] = []
  if (narrative.valueDisplay !== 'none') regions.push('value')
  if (mark.kind !== 'none') regions.push('plot')
  if (legend.placement === 'external') regions.push('legend')
  if (table.present) regions.push('table')
  return Object.freeze(regions)
}

function heatmapSemantics(
  sizeClass: SizeContext['sizeClass'],
  policy: PlanPolicy,
): HeatmapSemantics {
  const compact = sizeClass === 'micro' || sizeClass === 'tile'
  const strip = sizeClass === 'strip'
  const large = sizeClass === 'canvas' || sizeClass === 'stage'
  return Object.freeze({
    range: compact ? 'total' : strip ? 'recent-weeks' : 'full-range',
    weekdayLabels: compact || strip ? 'none' : large ? 'spelled' : 'axis-intent',
    monthLabels: compact || strip ? 'none' : 'axis-intent',
    intensityLegend: large ? 'external' : 'none',
    cellValues: sizeClass === 'stage' ? 'hover' : 'none',
    streakAnnotations: sizeClass === 'stage' ? 'visible' : 'none',
    cellBudget: policy.pointBudget,
    nominalCellFloorPx: policy.minCellSize,
    nominalCellFloorTier: 'C',
    accessibility: Object.freeze({
      cellText: compact ? 'summary' : sizeClass === 'stage' ? 'table-and-hover' : 'table',
      keyboard: compact ? 'widget' : 'cells',
    }),
  })
}

function planHeatmap(input: FamilyPlannerInput<HeatmapChartType>): HeatmapPlan {
  if (input.type !== 'heatmap') {
    throw new Error(`@shiftcharts/core: heatmap planner does not accept chart type '${input.type}'.`)
  }
  assertDataShape(input.shape)
  assertContext(input.ctx)
  assertPolicy(input.policy)

  const { sizeClass } = input.ctx
  const plotted = sizeClass !== 'micro' && sizeClass !== 'tile'
  const temporalBin = temporalBinFor(sizeClass, input.ctx, input.shape, input.policy)
  // Strip keeps the recent cell window but deliberately has no axis labels or axis chrome.
  const axes = sizeClass === 'panel' || sizeClass === 'canvas' || sizeClass === 'stage'
    ? axisPlan(input.ctx, input.policy)
    : { x: AXIS_OFF, y: AXIS_OFF }
  const primary: MarkSpec = plotted
    ? Object.freeze({ kind: 'cell', bandStart: 0, bandEnd: 1 })
    : Object.freeze({ kind: 'none' })
  const marks: MarksPlan = Object.freeze({
    primary,
    points: Object.freeze({ mode: 'none', autoHideDensityThreshold: null }),
    pointBudget: input.policy.pointBudget,
    renderer: input.shape.points > input.policy.pointBudget ? 'canvas' : 'svg',
    facet: Object.freeze({ mode: 'none' }),
  })
  const labels = labelsPlan()
  const legend = legendPlan(sizeClass, input.policy)
  const narrative = narrativePlan(sizeClass)
  const table = dataTablePlan(sizeClass)
  const aggregate = aggregatePlan(temporalBin)
  const semantics = heatmapSemantics(sizeClass, input.policy)

  return Object.freeze({
    type: input.type,
    sizeClass,
    valueLegibility:
      sizeClass === 'micro' || sizeClass === 'tile'
        ? 'single-value'
        : sizeClass === 'strip'
          ? 'shape-only'
          : 'values',
    orientation: 'vertical',
    regionOrder: regionOrder(narrative, primary, legend, table),
    axes: Object.freeze({ x: axes.x, y: axes.y, y2: null }),
    marks,
    labels,
    legend,
    interaction: interactionPlan(sizeClass),
    narrative,
    aggregate,
    dataTable: table,
    motion: motionPlan(sizeClass, temporalBin),
    heatmap: semantics,
  })
}

/** Pure, serialisable planner for the activity heatmap family. */
export const heatmapFamilyPlanner: FamilyPlanner<HeatmapChartType> = (input) => planHeatmap(input)

export const HEATMAP_PLANNER_FIXTURE = Object.freeze({
  type: 'heatmap' as const,
  nominalCellFloorPx: 8,
  nominalCellFloorTier: 'C' as const,
  cellBudget: 2000,
  stripRange: 'recent-weeks' as const,
  stageCellValues: 'hover' as const,
  stageStreakAnnotations: 'visible' as const,
})
