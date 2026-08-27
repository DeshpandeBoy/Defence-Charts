/**
 * Bar/timebar family planner.
 *
 * This module deliberately builds on the line ladder's complete chrome decisions while
 * replacing only the primary encoding. That keeps the six responsive size contracts total and
 * makes the family-specific decisions visible: bars retain a zero baseline, use grouped bars for
 * multiple series by default, and transpose when the inherited category-label degradation says
 * the x labels no longer fit.
 *
 * The shared frame populates `SeriesFrame.cells` for `MarkSpec['bar']`; the family renderer
 * consumes that explicit seam and never falls back to a line.
 */

import type { FamilyPlanner, FamilyPlannerInput } from '../../family-seam.ts'
import type { ChartPlan, ChartType, LegendPlan, MarkSpec, RegionName } from '../../plan.ts'
import {
  canvasRung,
  microRung,
  panelRung,
  stageRung,
  stripRung,
  tileRung,
} from '../../rungs/line.ts'

export type BarChartType = Extract<ChartType, 'bar' | 'timebar'>

export const BAR_CHART_TYPES: readonly BarChartType[] = Object.freeze(['bar', 'timebar'])

const BAR_RUNGS = Object.freeze({
  micro: microRung,
  tile: tileRung,
  strip: stripRung,
  panel: panelRung,
  canvas: canvasRung,
  stage: stageRung,
})

function barMark(input: FamilyPlannerInput<BarChartType>, seed: ChartPlan): MarkSpec {
  if (seed.marks.primary.kind === 'none') return Object.freeze({ kind: 'none' })

  // Grouping is the conservative product default: it preserves per-series comparison without
  // inventing a stack order or implying additive parts. Stacking remains an explicit future
  // policy/prop decision rather than a hidden heuristic.
  return Object.freeze({
    kind: 'bar',
    stacked: false,
    grouped: input.shape.series > 1,
  })
}

/**
 * Bar identity needs a dedicated home because end-of-line labels are not a stable affordance
 * for a finite rectangle: on the last category they sit over the mark and make the plot edge
 * feel clipped. The compact strip gets one reserved identity row; larger bars get a centered
 * bottom band. Micro has no mark, Tile is still a value/sparkline budget, and one-series bars
 * retain the seed's direct label because there is no competing series identity to decode.
 */
function barLegend(
  input: FamilyPlannerInput<BarChartType>,
  seed: ChartPlan,
  primary: MarkSpec,
): LegendPlan {
  if (primary.kind !== 'bar' || input.shape.series <= 1) return seed.legend
  if (input.ctx.sizeClass === 'strip') {
    return Object.freeze({
      placement: 'internal',
      maxEntries: input.policy.legendMaxEntries,
      flow: 'reserved',
    })
  }
  if (input.ctx.sizeClass === 'panel' || input.ctx.sizeClass === 'canvas' || input.ctx.sizeClass === 'stage') {
    return Object.freeze({
      placement: 'external',
      position: 'bottom',
      maxEntries: input.policy.legendMaxEntries,
      showValues: false,
      showPercent: false,
    })
  }
  return Object.freeze({ placement: 'absent' })
}

function barRegionOrder(seed: ChartPlan, legend: LegendPlan): readonly RegionName[] {
  const regions: RegionName[] = seed.regionOrder.filter((region) => region !== 'legend')
  if (legend.placement === 'external') {
    const tableIndex = regions.indexOf('table')
    regions.splice(tableIndex < 0 ? regions.length : tableIndex, 0, 'legend')
  }
  return Object.freeze(regions)
}

function planBar(input: FamilyPlannerInput<BarChartType>): ChartPlan {
  const rung = BAR_RUNGS[input.ctx.sizeClass]
  const seed = rung({
    type: 'line',
    ctx: input.ctx,
    shape: input.shape,
    policy: input.policy,
  })
  const primary = barMark(input, seed)
  const legend = barLegend(input, seed, primary)

  return Object.freeze({
    ...seed,
    type: input.type,
    orientation: seed.orientation,
    regionOrder: barRegionOrder(seed, legend),
    labels: Object.freeze({
      ...seed.labels,
      seriesLabels:
        legend.placement === 'direct' || legend.placement === 'absent'
          ? seed.labels.seriesLabels
          : 'none',
    }),
    legend,
    marks: Object.freeze({
      ...seed.marks,
      primary,
      // Points are a line-family affordance. A bar family exposes its rectangles instead.
      points: Object.freeze({ mode: 'none', autoHideDensityThreshold: null }),
    }),
  })
}

/** Pure, serialisable planner for the bar and timebar family. */
export const barFamilyPlanner: FamilyPlanner<BarChartType> = (input) => planBar(input)

export const BAR_PLANNER_FIXTURES = Object.freeze([
  Object.freeze({ type: 'bar' as const, sizeClass: 'panel' as const }),
  Object.freeze({ type: 'timebar' as const, sizeClass: 'stage' as const }),
])
