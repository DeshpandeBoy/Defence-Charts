/**
 * Funnel family planner.
 *
 * A funnel is an ordered, non-negative sequence of stages, not a line with a different
 * silhouette. The planner receives only DataShape, so it records the information state and
 * rejects the value-shape ambiguities that DataShape can prove. Canonical x ordering, null and
 * non-finite value handling, stage geometry, conversion math, and stable stage keys remain the
 * value-aware frame seam owned by the coordinator.
 *
 * No funnel geometry threshold below is a perception claim. The family has no funnel-specific
 * primary research handoff yet; any future minimum stage geometry must remain Tier C until that
 * evidence exists.
 */

import type { DataShape, SizeContext } from '../../context.ts'
import type { FamilyPlanner, FamilyPlannerInput } from '../../family-seam.ts'
import {
  AXIS_OFF,
  type ChartPlan,
  type ChartType,
  type DataTablePlan,
  type FunnelSemantics,
  type InteractionPlan,
  type LabelsPlan,
  type MarkSpec,
  type MotionPlan,
  type RegionName,
} from '../../plan.ts'
import type { PlanPolicy } from '../../policy.ts'
import {
  canvasRung,
  microRung,
  panelRung,
  stageRung,
  stripRung,
  tileRung,
} from '../../rungs/line.ts'

export type FunnelChartType = Extract<ChartType, 'funnel'>

export const FUNNEL_CHART_TYPES: readonly FunnelChartType[] = Object.freeze(['funnel'])

/** The complete serialisable result returned by this family-local planner. */
export type FunnelPlan = ChartPlan & {
  readonly funnel: FunnelSemantics
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

const NO_AGGREGATE = Object.freeze({
  after: null,
  minShare: null,
  otherBucket: false,
  expandable: false,
  temporalBin: 'none' as const,
})

function isFiniteNonNegativeInteger(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && Number.isInteger(value)
}

function assertDataShape(shape: DataShape): void {
  if (!isFiniteNonNegativeInteger(shape.series)) {
    throw new Error('@gx/core: funnel shape.series must be a finite non-negative integer.')
  }
  if (!isFiniteNonNegativeInteger(shape.categories)) {
    throw new Error('@gx/core: funnel shape.categories must be a finite non-negative integer.')
  }
  if (!isFiniteNonNegativeInteger(shape.points)) {
    throw new Error('@gx/core: funnel shape.points must be a finite non-negative integer.')
  }
  if (!isFiniteNonNegativeInteger(shape.labelMaxChars)) {
    throw new Error('@gx/core: funnel shape.labelMaxChars must be a finite non-negative integer.')
  }
  if (typeof shape.hasNegative !== 'boolean' || typeof shape.temporal !== 'boolean') {
    throw new Error('@gx/core: funnel shape flags must be booleans.')
  }
  if (shape.hasNegative) {
    throw new Error('@gx/core: funnel requires finite non-negative stage values.')
  }
  if (shape.series > 1) {
    throw new Error('@gx/core: funnel requires exactly one series of ordered stages.')
  }

  // `describeShape()` reports distinct x positions as categories. For the one-series funnel,
  // points > categories is therefore duplicate-stage evidence. Do not silently aggregate or
  // choose an order here; the frame must also reject duplicates when it receives raw values.
  if (shape.series === 1 && shape.points > shape.categories) {
    throw new Error('@gx/core: funnel requires one value per canonical stage; duplicate x values are ambiguous.')
  }
  if (shape.series === 0 && (shape.points !== 0 || shape.categories !== 0)) {
    throw new Error('@gx/core: funnel empty shapes must have zero points and categories.')
  }
  if (shape.categories > shape.points) {
    throw new Error('@gx/core: funnel shape.categories cannot exceed shape.points.')
  }
}

function assertContext(ctx: SizeContext): void {
  if (!SIZE_CLASSES.includes(ctx.sizeClass)) {
    throw new Error(`@gx/core: funnel does not support size class '${String(ctx.sizeClass)}'.`)
  }
  if (!Number.isFinite(ctx.width) || ctx.width < 0 || !Number.isFinite(ctx.height) || ctx.height < 0) {
    throw new Error('@gx/core: funnel context dimensions must be finite and non-negative.')
  }
  if (!isFiniteNonNegativeInteger(ctx.cols) || !isFiniteNonNegativeInteger(ctx.rows)) {
    throw new Error('@gx/core: funnel context grid dimensions must be finite non-negative integers.')
  }
  if (!ASPECTS.includes(ctx.aspect)) {
    throw new Error(`@gx/core: funnel does not support aspect '${String(ctx.aspect)}'.`)
  }
}

function assertPolicy(policy: PlanPolicy): void {
  if (!isFiniteNonNegativeInteger(policy.pointBudget)) {
    throw new Error('@gx/core: funnel point budget must be a finite non-negative integer.')
  }
}

function rungFor(input: FamilyPlannerInput<FunnelChartType>): ChartPlan {
  const args = {
    type: 'line' as const,
    ctx: input.ctx,
    shape: input.shape,
    policy: input.policy,
  }
  switch (input.ctx.sizeClass) {
    case 'micro':
      return microRung(args)
    case 'tile':
      return tileRung(args)
    case 'strip':
      return stripRung(args)
    case 'panel':
      return panelRung(args)
    case 'canvas':
      return canvasRung(args)
    case 'stage':
      return stageRung(args)
  }
}

function markFor(sizeClass: SizeContext['sizeClass']): MarkSpec {
  if (sizeClass === 'micro') return Object.freeze({ kind: 'none' })
  if (sizeClass === 'tile') {
    return Object.freeze({ kind: 'funnel', orientation: 'vertical', detail: 'summary' })
  }
  if (sizeClass === 'strip') {
    return Object.freeze({ kind: 'funnel', orientation: 'horizontal', detail: 'stages' })
  }
  if (sizeClass === 'panel') {
    return Object.freeze({ kind: 'funnel', orientation: 'vertical', detail: 'stages' })
  }
  if (sizeClass === 'canvas') {
    return Object.freeze({ kind: 'funnel', orientation: 'vertical', detail: 'dropoff' })
  }
  return Object.freeze({ kind: 'funnel', orientation: 'vertical', detail: 'breakdown' })
}

function labelsFor(sizeClass: SizeContext['sizeClass']): LabelsPlan {
  return Object.freeze({
    seriesLabels: 'none',
    valueLabels: sizeClass === 'panel' || sizeClass === 'canvas' || sizeClass === 'stage' ? 'all' : 'none',
    // Strip explicitly records the early axis transpose. The funnel renderer uses stage labels,
    // not a numeric x-axis, so all other rungs keep axis labels absent rather than inventing a
    // meaningless numeric axis.
    axisLabelDegrade: sizeClass === 'strip' ? 'axis-transpose' : 'none',
    maxChars: null,
    labelHalo: 'none',
  })
}

function interactionFor(sizeClass: SizeContext['sizeClass']): InteractionPlan {
  if (sizeClass === 'micro' || sizeClass === 'tile') {
    return Object.freeze({
      trigger: 'none',
      tooltip: Object.freeze({ enabled: false, placement: 'fix' }),
      crosshair: false,
      brush: false,
      zoom: false,
      legendToggle: false,
    })
  }

  if (sizeClass === 'strip' || sizeClass === 'panel') {
    return Object.freeze({
      trigger: sizeClass === 'strip' ? 'tap' : 'hover',
      tooltip: Object.freeze({ enabled: true, placement: 'fix' }),
      crosshair: sizeClass === 'panel',
      brush: false,
      zoom: false,
      legendToggle: false,
    })
  }

  return Object.freeze({
    trigger: 'hover',
    tooltip: Object.freeze({ enabled: true, placement: 'fluid' }),
    // No brush/zoom evidence is present for this family. Keep the absence explicit until a
    // funnel-specific interaction contract promotes either capability.
    crosshair: true,
    brush: false,
    zoom: false,
    legendToggle: false,
  })
}

function dataTableFor(sizeClass: SizeContext['sizeClass']): DataTablePlan {
  const compact = sizeClass === 'micro' || sizeClass === 'tile'
  return Object.freeze({
    present: true,
    disclosure: compact ? 'widget-tap' : 'button',
    initiallyExpanded: false,
    columns: compact ? 'summary' : 'all',
  })
}

function motionFor(sizeClass: SizeContext['sizeClass']): MotionPlan {
  return Object.freeze({
    durationClass: 'recompose',
    stages: sizeClass === 'micro' || sizeClass === 'tile' ? 1 : 2,
    persistGridlines: false,
    objectConstancy: false,
  })
}

function semanticsFor(sizeClass: SizeContext['sizeClass']): FunnelSemantics {
  if (sizeClass === 'micro' || sizeClass === 'tile') {
    return Object.freeze({
      summary: 'conversion',
      stageLabels: 'none',
      stageValues: 'none',
      dropoff: 'none',
      conversion: 'overall',
      accessibility: Object.freeze({ stageText: 'summary', keyboard: 'widget' }),
    })
  }

  if (sizeClass === 'strip') {
    return Object.freeze({
      summary: 'none',
      stageLabels: 'all',
      stageValues: 'none',
      dropoff: 'none',
      conversion: 'none',
      accessibility: Object.freeze({ stageText: 'table-and-mark', keyboard: 'stages' }),
    })
  }

  if (sizeClass === 'panel') {
    return Object.freeze({
      summary: 'none',
      stageLabels: 'all',
      stageValues: 'all',
      dropoff: 'none',
      conversion: 'none',
      accessibility: Object.freeze({ stageText: 'table-and-mark', keyboard: 'stages' }),
    })
  }

  if (sizeClass === 'canvas') {
    return Object.freeze({
      summary: 'none',
      stageLabels: 'all',
      stageValues: 'all',
      dropoff: 'per-stage',
      conversion: 'none',
      accessibility: Object.freeze({ stageText: 'table-and-mark', keyboard: 'stages' }),
    })
  }

  return Object.freeze({
    // Stage keeps the overall summary available while adding per-stage relative conversion.
    summary: 'conversion',
    stageLabels: 'all',
    stageValues: 'all',
    dropoff: 'per-stage',
    conversion: 'relative',
    accessibility: Object.freeze({ stageText: 'table-and-mark', keyboard: 'stages' }),
  })
}

function regionOrder(
  narrative: ChartPlan['narrative'],
  mark: MarkSpec,
  table: DataTablePlan,
): readonly RegionName[] {
  const regions: RegionName[] = []
  if (narrative.valueDisplay !== 'none') regions.push('value')
  if (mark.kind !== 'none') regions.push('plot')
  if (table.present) regions.push('table')
  return Object.freeze(regions)
}

function planFunnel(input: FamilyPlannerInput<FunnelChartType>): FunnelPlan {
  if (input.type !== 'funnel') {
    throw new Error(`@gx/core: funnel planner does not accept chart type '${input.type}'.`)
  }
  assertDataShape(input.shape)
  assertContext(input.ctx)
  assertPolicy(input.policy)

  const seed = rungFor(input)
  const mark = markFor(input.ctx.sizeClass)
  const labels = labelsFor(input.ctx.sizeClass)
  const table = dataTableFor(input.ctx.sizeClass)
  const semantics = semanticsFor(input.ctx.sizeClass)
  const orientation = input.ctx.sizeClass === 'strip' ? 'horizontal' : 'vertical'
  const narrative = Object.freeze({
    ...seed.narrative,
    summaryPhrase: false,
    // Micro has only the value region. Tile replaces that region with the explicit vertical
    // summary mark, so its conversion is not painted a second time by the shared value renderer.
    valueDisplay: input.ctx.sizeClass === 'micro' ? 'latest' as const : 'none' as const,
    deltaBasis: false,
    callouts: 'none' as const,
    annotations: input.ctx.sizeClass === 'stage',
    thresholdBands: false,
  })

  return Object.freeze({
    ...seed,
    type: input.type,
    valueLegibility: mark.kind === 'none' ? 'single-value' : 'shape-only',
    orientation,
    regionOrder: regionOrder(narrative, mark, table),
    axes: Object.freeze({ x: AXIS_OFF, y: AXIS_OFF, y2: null }),
    marks: Object.freeze({
      ...seed.marks,
      primary: mark,
      // Funnel stages are not line points. The value-aware frame owns their stage geometry and
      // identity; keeping this explicit prevents a renderer from painting a second point layer.
      points: Object.freeze({ mode: 'none', autoHideDensityThreshold: null }),
      renderer: 'svg',
      facet: Object.freeze({ mode: 'none' }),
    }),
    labels,
    legend: Object.freeze({ placement: 'absent' }),
    interaction: interactionFor(input.ctx.sizeClass),
    narrative,
    aggregate: NO_AGGREGATE,
    dataTable: table,
    motion: motionFor(input.ctx.sizeClass),
    funnel: semantics,
  })
}

/** Pure, serialisable planner for the ordered funnel family. */
export const funnelFamilyPlanner: FamilyPlanner<FunnelChartType> = (input) => planFunnel(input)

export const FUNNEL_PLANNER_FIXTURE = Object.freeze({
  type: 'funnel' as const,
  compactSummary: 'overall-conversion' as const,
  stripOrientation: 'horizontal' as const,
  panelOrientation: 'vertical' as const,
  canvasDetail: 'dropoff' as const,
  stageDetail: 'breakdown' as const,
  geometryDefaultTier: 'C' as const,
  zeroBaseline: 'null-conversion-and-dropoff' as const,
})
