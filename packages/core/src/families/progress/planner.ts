/**
 * Progress family planner.
 *
 * Progress is target-aware completion, not a donut with one slice and not a KPI with a
 * different label. The responsive contract makes a real encoding substitution: a radial mark
 * at Micro/Tile and a horizontal mark from Strip through Stage. This module receives only
 * `DataShape`, so current/target validation and ratio/remaining/over-target derivation remain in
 * the value-aware frame boundary; the assumptions are recorded in `fixture.ts` and its tests.
 */

import type { FamilyPlanner, FamilyPlannerInput } from '../../family-seam.ts'
import type { AxisPlan, ChartPlan, ChartType, DataTablePlan, MarkSpec, RegionName } from '../../plan.ts'
import { AXIS_OFF } from '../../plan.ts'
import {
  canvasRung,
  microRung,
  panelRung,
  stageRung,
  stripRung,
  tileRung,
} from '../../rungs/line.ts'

export type ProgressChartType = Extract<ChartType, 'progress'>

export const PROGRESS_CHART_TYPES: readonly ProgressChartType[] = Object.freeze(['progress'])

const PROGRESS_RUNGS = Object.freeze({
  micro: microRung,
  tile: tileRung,
  strip: stripRung,
  panel: panelRung,
  canvas: canvasRung,
  stage: stageRung,
})

const NO_PROGRESS_AGGREGATE = Object.freeze({
  after: null,
  minShare: null,
  otherBucket: false,
  expandable: false,
  temporalBin: 'none' as const,
})

const NO_PROGRESS_LEGEND = Object.freeze({ placement: 'absent' as const })

const NO_PROGRESS_LABELS = Object.freeze({
  seriesLabels: 'none' as const,
  valueLabels: 'none' as const,
  axisLabelDegrade: 'none' as const,
  maxChars: null,
  labelHalo: 'none' as const,
})

const NO_PROGRESS_INTERACTION = Object.freeze({
  crosshair: false,
  brush: false,
  zoom: false,
  legendToggle: false,
})

const NO_PROGRESS_MOTION = Object.freeze({
  durationClass: 'recompose' as const,
  stages: 1 as const,
  persistGridlines: false,
  objectConstancy: false,
})

function progressMark(orientation: Extract<MarkSpec, { readonly kind: 'progress' }>['orientation']): MarkSpec {
  return Object.freeze({ kind: 'progress', orientation })
}

function progressRegions(valueDisplay: ChartPlan['narrative']['valueDisplay']): readonly RegionName[] {
  const regions: RegionName[] = []
  if (valueDisplay !== 'none') regions.push('value')
  regions.push('plot', 'table')
  return Object.freeze(regions)
}

function progressInteraction(sizeClass: FamilyPlannerInput<ProgressChartType>['ctx']['sizeClass']) {
  if (sizeClass === 'micro' || sizeClass === 'tile') {
    return Object.freeze({
      trigger: 'none' as const,
      tooltip: Object.freeze({ enabled: false, placement: 'fix' as const }),
      ...NO_PROGRESS_INTERACTION,
    })
  }

  if (sizeClass === 'strip' || sizeClass === 'panel') {
    return Object.freeze({
      trigger: sizeClass === 'strip' ? ('tap' as const) : ('hover' as const),
      tooltip: Object.freeze({ enabled: true, placement: 'fix' as const }),
      ...NO_PROGRESS_INTERACTION,
    })
  }

  return Object.freeze({
    trigger: 'hover' as const,
    tooltip: Object.freeze({ enabled: true, placement: 'fluid' as const }),
    ...NO_PROGRESS_INTERACTION,
  })
}

function progressDataTable(sizeClass: FamilyPlannerInput<ProgressChartType>['ctx']['sizeClass']): DataTablePlan {
  const compact = sizeClass === 'micro' || sizeClass === 'tile'
  return Object.freeze({
    present: true,
    disclosure: compact ? 'widget-tap' : 'button',
    initiallyExpanded: false,
    columns: compact ? 'summary' : 'all',
  })
}

function progressNarrative(
  sizeClass: FamilyPlannerInput<ProgressChartType>['ctx']['sizeClass'],
): ChartPlan['narrative'] {
  const micro = sizeClass === 'micro'
  return Object.freeze({
    // Micro is explicitly ring-only. Tile adds the percent/current display; Strip and larger
    // rungs add the target-aware current/target/remaining text through the shared frame.
    summaryPhrase: false,
    valueDisplay: micro ? ('none' as const) : ('latest' as const),
    valueTypeScale: 'fit' as const,
    deltaBasis: false,
    callouts: 'none' as const,
    annotations: false,
    thresholdBands: false,
  })
}

function planProgress(input: FamilyPlannerInput<ProgressChartType>): ChartPlan {
  if (input.type !== 'progress') {
    throw new Error(`@shiftcharts/core: progress planner does not accept chart type '${input.type}'.`)
  }

  const seed = PROGRESS_RUNGS[input.ctx.sizeClass]({
    // The line rung supplies the total plan shape and plot-box chrome. Every line-specific
    // decision that would misdescribe progress is replaced below; no line mark survives.
    type: 'line',
    ctx: input.ctx,
    shape: input.shape,
    policy: input.policy,
  })
  const radial = input.ctx.sizeClass === 'micro' || input.ctx.sizeClass === 'tile'
  const valueDisplay = radial && input.ctx.sizeClass === 'micro' ? 'none' : 'latest'
  const primary = progressMark(radial ? 'radial' : 'horizontal')
  const dataTable = progressDataTable(input.ctx.sizeClass)
  const narrative = progressNarrative(input.ctx.sizeClass)

  const axes: { readonly x: AxisPlan; readonly y: AxisPlan; readonly y2: null } = Object.freeze({
    x: AXIS_OFF,
    y: AXIS_OFF,
    y2: null,
  })

  return Object.freeze({
    ...seed,
    type: input.type,
    valueLegibility: input.ctx.sizeClass === 'micro' ? 'shape-only' : 'single-value',
    orientation: 'vertical',
    regionOrder: progressRegions(valueDisplay),
    axes,
    marks: Object.freeze({
      ...seed.marks,
      primary,
      points: Object.freeze({ mode: 'none', autoHideDensityThreshold: null }),
      // Progress consumes only each series' latest finite point; source-history length does not
      // increase SVG geometry, so it remains an explicit SVG mark rather than a line fallback or
      // a misleading canvas threshold.
      renderer: 'svg',
      facet: Object.freeze({ mode: 'none' as const }),
    }),
    labels: NO_PROGRESS_LABELS,
    legend: NO_PROGRESS_LEGEND,
    interaction: progressInteraction(input.ctx.sizeClass),
    narrative,
    aggregate: NO_PROGRESS_AGGREGATE,
    dataTable,
    motion: NO_PROGRESS_MOTION,
  })
}

/** Pure, serialisable planner for the target-aware progress family. */
export const progressFamilyPlanner: FamilyPlanner<ProgressChartType> = (input) => planProgress(input)

export const PROGRESS_PLANNER_FIXTURE = Object.freeze({
  type: 'progress' as const,
  radialSizeClasses: Object.freeze(['micro', 'tile'] as const),
  horizontalSizeClasses: Object.freeze(['strip', 'panel', 'canvas', 'stage'] as const),
  microValueDisplay: 'none' as const,
  comparisonValueDisplay: 'latest' as const,
  targetValidation: 'finite-positive-only' as const,
})
