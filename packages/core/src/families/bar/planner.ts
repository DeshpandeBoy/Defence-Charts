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
import type { ChartPlan, ChartType, MarkSpec } from '../../plan.ts'
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

function planBar(input: FamilyPlannerInput<BarChartType>): ChartPlan {
  const rung = BAR_RUNGS[input.ctx.sizeClass]
  const seed = rung({
    type: 'line',
    ctx: input.ctx,
    shape: input.shape,
    policy: input.policy,
  })
  const primary = barMark(input, seed)

  return Object.freeze({
    ...seed,
    type: input.type,
    orientation: seed.orientation,
    regionOrder: Object.freeze(seed.regionOrder),
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
