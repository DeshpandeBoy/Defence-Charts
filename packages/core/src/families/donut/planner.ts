/**
 * Donut family planner.
 *
 * Donut keeps the shared responsive chrome decisions but owns a distinct arc/legend/aggregate
 * contract. The planner sees only `DataShape`; value validation and value-aware bucketing belong
 * to `resolveFrame()`, where the actual points are available.
 */

import type { FamilyPlanner, FamilyPlannerInput } from '../../family-seam.ts'
import { AXIS_OFF, type AxesPlan, type ChartPlan, type ChartType, type LegendPlan, type MarkSpec } from '../../plan.ts'
import {
  canvasRung,
  microRung,
  panelRung,
  stageRung,
  stripRung,
  tileRung,
} from '../../rungs/line.ts'

export type DonutChartType = Extract<ChartType, 'donut'>

export const DONUT_CHART_TYPES: readonly DonutChartType[] = Object.freeze(['donut'])

const DONUT_RUNGS = Object.freeze({
  micro: microRung,
  tile: tileRung,
  strip: stripRung,
  panel: panelRung,
  canvas: canvasRung,
  stage: stageRung,
})

const DONUT_AXES: AxesPlan = Object.freeze({ x: AXIS_OFF, y: AXIS_OFF, y2: null })

function donutLegend(sizeClass: FamilyPlannerInput<DonutChartType>['ctx']['sizeClass'], maxEntries: number): LegendPlan {
  if (sizeClass === 'panel') return Object.freeze({ placement: 'internal', maxEntries, flow: 'overlay' })
  if (sizeClass === 'canvas' || sizeClass === 'stage') {
    return Object.freeze({
      placement: 'external',
      position: 'left',
      maxEntries,
      showValues: true,
      showPercent: true,
    })
  }
  return Object.freeze({ placement: 'absent' })
}

function donutMark(seed: ChartPlan): MarkSpec {
  return seed.marks.primary.kind === 'none' ? Object.freeze({ kind: 'none' }) : Object.freeze({ kind: 'arc', donut: true })
}

function planDonut(input: FamilyPlannerInput<DonutChartType>): ChartPlan {
  if (input.shape.hasNegative) {
    throw new Error('@shiftcharts/core: donut requires non-negative parts-of-a-whole values.')
  }
  const seed = DONUT_RUNGS[input.ctx.sizeClass]({
    type: 'line',
    ctx: input.ctx,
    shape: input.shape,
    policy: input.policy,
  })
  const primary = donutMark(seed)
  const micro = primary.kind === 'none'
  const legend = micro ? Object.freeze({ placement: 'absent' as const }) : donutLegend(input.ctx.sizeClass, input.policy.legendMaxEntries)
  const externalLegend = legend.placement === 'external'
  const aggregate =
    input.ctx.sizeClass === 'canvas' || input.ctx.sizeClass === 'stage'
      ? Object.freeze({
          after: input.policy.aggregateAfter,
          minShare: 0.02,
          otherBucket: true,
          expandable: input.ctx.sizeClass === 'stage',
          temporalBin: 'none' as const,
        })
      : Object.freeze({
          after: null,
          minShare: null,
          otherBucket: false,
          expandable: false,
          temporalBin: 'none' as const,
        })

  return Object.freeze({
    ...seed,
    type: input.type,
    valueLegibility: micro ? 'single-value' : 'shape-only',
    axes: DONUT_AXES,
    regionOrder: Object.freeze(
      micro
        ? (['value', 'table'] as const)
        : externalLegend
          ? (['plot', 'legend', 'table'] as const)
          : input.ctx.sizeClass === 'tile'
            ? (['value', 'plot', 'table'] as const)
            : (['plot', 'table'] as const),
    ),
    marks: Object.freeze({
      ...seed.marks,
      primary,
      points: Object.freeze({ mode: 'none', autoHideDensityThreshold: null }),
    }),
    labels: Object.freeze({
      ...seed.labels,
      seriesLabels: 'none',
      valueLabels: 'none',
    }),
    legend,
    narrative: Object.freeze({
      ...seed.narrative,
      valueDisplay: micro || input.ctx.sizeClass === 'tile' ? 'latest' : 'none',
    }),
    aggregate,
    motion: Object.freeze({
      ...seed.motion,
      objectConstancy: aggregate.otherBucket,
    }),
  })
}

/** Pure, serialisable planner for the donut family. */
export const donutFamilyPlanner: FamilyPlanner<DonutChartType> = (input) => planDonut(input)

export const DONUT_PLANNER_FIXTURE = Object.freeze({
  type: 'donut' as const,
  canvasAggregateAfter: 8,
  canvasMinShare: 0.02,
  stageExpandable: true,
})
